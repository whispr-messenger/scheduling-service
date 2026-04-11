import { ConfigService } from '@nestjs/config';
import { buildRedisConnection, parseSentinels } from './redis-connection';

function makeConfigService(env: Record<string, string | undefined>): ConfigService {
	return {
		get: <T>(key: string, defaultValue?: T): T => {
			const v = env[key];
			return (v ?? defaultValue) as T;
		},
	} as ConfigService;
}

describe('parseSentinels', () => {
	it('parses a single host:port pair', () => {
		expect(parseSentinels('redis.svc:26379')).toEqual([{ host: 'redis.svc', port: 26379 }]);
	});

	it('parses multiple comma-separated pairs and trims whitespace', () => {
		expect(parseSentinels('a:1 , b:2,c:3')).toEqual([
			{ host: 'a', port: 1 },
			{ host: 'b', port: 2 },
			{ host: 'c', port: 3 },
		]);
	});

	it('ignores empty segments', () => {
		expect(parseSentinels('a:1,,b:2')).toEqual([
			{ host: 'a', port: 1 },
			{ host: 'b', port: 2 },
		]);
	});
});

describe('buildRedisConnection', () => {
	describe('direct mode', () => {
		it('builds host+port options from env', () => {
			const cs = makeConfigService({
				REDIS_HOST: 'cache.local',
				REDIS_PORT: '6380',
				REDIS_DB: '3',
				REDIS_USERNAME: 'alice',
				REDIS_PASSWORD: 'fake-password',
			});

			const opts = buildRedisConnection(cs);

			expect(opts).toMatchObject({
				host: 'cache.local',
				port: 6380,
				db: 3,
				username: 'alice',
				password: 'fake-password',
			});
			expect(opts.sentinels).toBeUndefined();
		});

		it('defaults host/port/db when env vars are missing', () => {
			const opts = buildRedisConnection(makeConfigService({}));
			expect(opts).toMatchObject({ host: 'localhost', port: 6379, db: 0 });
			expect(opts.username).toBeUndefined();
			expect(opts.password).toBeUndefined();
		});

		it('sets a reconnectOnError that matches NOAUTH errors', () => {
			const opts = buildRedisConnection(makeConfigService({}));
			expect(typeof opts.reconnectOnError).toBe('function');
			expect(opts.reconnectOnError!(new Error('NOAUTH Authentication required.'))).toBe(true);
			expect(opts.reconnectOnError!(new Error('ECONNRESET'))).toBe(false);
		});
	});

	describe('sentinel mode', () => {
		const baseEnv = {
			REDIS_MODE: 'sentinel',
			REDIS_SENTINELS: 'sent1:26379,sent2:26379',
			REDIS_MASTER_NAME: 'mymaster',
			REDIS_SENTINEL_PASSWORD: 'fake-sentinel-password',
			REDIS_USERNAME: 'bob',
			REDIS_PASSWORD: 'fake-node-password',
			REDIS_DB: '5',
		};

		it('builds sentinel options with username and sentinelPassword', () => {
			const opts = buildRedisConnection(makeConfigService(baseEnv));
			expect(opts).toMatchObject({
				name: 'mymaster',
				sentinels: [
					{ host: 'sent1', port: 26379 },
					{ host: 'sent2', port: 26379 },
				],
				db: 5,
				username: 'bob',
				password: 'fake-node-password',
				sentinelPassword: 'fake-sentinel-password',
			});
			// Must not leak direct-mode host/port in sentinel mode
			expect((opts as { host?: string }).host).toBeUndefined();
		});

		it.each([
			['REDIS_SENTINELS', 'REDIS_SENTINELS is required when REDIS_MODE=sentinel'],
			['REDIS_MASTER_NAME', 'REDIS_MASTER_NAME is required when REDIS_MODE=sentinel'],
			['REDIS_SENTINEL_PASSWORD', 'REDIS_SENTINEL_PASSWORD is required when REDIS_MODE=sentinel'],
		])('throws when %s is missing', (missingKey, expectedMessage) => {
			const env = { ...baseEnv, [missingKey]: undefined };
			expect(() => buildRedisConnection(makeConfigService(env))).toThrow(expectedMessage);
		});
	});
});
