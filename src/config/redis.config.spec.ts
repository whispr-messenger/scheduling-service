import { ConfigService } from '@nestjs/config';
import { buildRedisOptions, parseSentinels } from './redis.config';

function makeConfig(values: Record<string, string>): ConfigService {
	return {
		get: (key: string, defaultValue?: unknown) => (key in values ? values[key] : defaultValue),
	} as unknown as ConfigService;
}

describe('parseSentinels', () => {
	it('parses a single sentinel', () => {
		expect(parseSentinels('redis-sentinel:26379')).toEqual([{ host: 'redis-sentinel', port: 26379 }]);
	});

	it('parses multiple sentinels', () => {
		expect(parseSentinels('s1:26379,s2:26380')).toEqual([
			{ host: 's1', port: 26379 },
			{ host: 's2', port: 26380 },
		]);
	});

	it('trims whitespace around entries', () => {
		expect(parseSentinels(' s1:26379 , s2:26380 ')).toEqual([
			{ host: 's1', port: 26379 },
			{ host: 's2', port: 26380 },
		]);
	});
});

describe('buildRedisOptions — direct mode', () => {
	it('returns host/port options by default', () => {
		const cfg = makeConfig({ REDIS_HOST: 'myhost', REDIS_PORT: '6380', REDIS_DB: '2' });
		const opts = buildRedisOptions(cfg);
		expect(opts).toMatchObject({ host: 'myhost', port: 6380, db: 2 });
		expect('sentinels' in opts).toBe(false);
	});

	it('includes password when provided', () => {
		const cfg = makeConfig({ REDIS_PASSWORD: 'secret' });
		const opts = buildRedisOptions(cfg);
		expect(opts.password).toBe('secret');
	});

	it('uses defaults when env vars absent', () => {
		const opts = buildRedisOptions(makeConfig({}));
		expect(opts).toMatchObject({ host: 'localhost', port: 6379, db: 0 });
	});
});

describe('buildRedisOptions — sentinel mode', () => {
	const baseEnv = {
		REDIS_MODE: 'sentinel',
		REDIS_SENTINELS: 's1:26379,s2:26380',
		REDIS_MASTER_NAME: 'mymaster',
		REDIS_DB: '5',
	};

	it('returns sentinel options', () => {
		const opts = buildRedisOptions(makeConfig(baseEnv));
		expect(opts).toMatchObject({
			name: 'mymaster',
			db: 5,
			sentinels: [
				{ host: 's1', port: 26379 },
				{ host: 's2', port: 26380 },
			],
		});
		expect('host' in opts).toBe(false);
	});

	it('throws when REDIS_SENTINELS is missing', () => {
		const cfg = makeConfig({ REDIS_MODE: 'sentinel', REDIS_MASTER_NAME: 'mymaster' });
		expect(() => buildRedisOptions(cfg)).toThrow('REDIS_SENTINELS is required');
	});

	it('throws when REDIS_MASTER_NAME is missing', () => {
		const cfg = makeConfig({ REDIS_MODE: 'sentinel', REDIS_SENTINELS: 's1:26379' });
		expect(() => buildRedisOptions(cfg)).toThrow('REDIS_MASTER_NAME is required');
	});
});
