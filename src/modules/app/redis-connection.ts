import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function parseSentinels(sentinelsStr: string): Array<{ host: string; port: number }> {
	return sentinelsStr
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => {
			const [host, port] = s.split(':');
			return { host, port: Number.parseInt(port, 10) };
		});
}

export function buildRedisConnection(configService: ConfigService): RedisOptions {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	const db = Number.parseInt(configService.get<string>('REDIS_DB', '0'), 10);
	const username = configService.get<string>('REDIS_USERNAME') || undefined;
	const password = configService.get<string>('REDIS_PASSWORD') || undefined;

	const reconnectOnError = (err: Error) => err.message.includes('NOAUTH');

	if (mode === 'sentinel') {
		const sentinelsStr = configService.get<string>('REDIS_SENTINELS');
		const masterName = configService.get<string>('REDIS_MASTER_NAME');
		const sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');

		if (!sentinelsStr) {
			throw new Error('REDIS_SENTINELS is required when REDIS_MODE=sentinel');
		}
		if (!masterName) {
			throw new Error('REDIS_MASTER_NAME is required when REDIS_MODE=sentinel');
		}
		if (!sentinelPassword) {
			throw new Error('REDIS_SENTINEL_PASSWORD is required when REDIS_MODE=sentinel');
		}

		return {
			sentinels: parseSentinels(sentinelsStr),
			name: masterName,
			db,
			username,
			password,
			sentinelPassword,
			reconnectOnError,
		};
	}

	const host = configService.get<string>('REDIS_HOST', 'localhost');
	const port = Number.parseInt(configService.get<string>('REDIS_PORT', '6379'), 10);

	return {
		host,
		port,
		db,
		username,
		password,
		reconnectOnError,
	};
}
