import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function parseSentinels(sentinelsStr: string): Array<{ host: string; port: number }> {
	return sentinelsStr
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => {
			const parts = s.split(':');
			if (parts.length !== 2) {
				throw new Error(`Invalid REDIS_SENTINELS entry "${s}": expected format host:port`);
			}
			const host = parts[0].trim();
			const portStr = parts[1].trim();
			if (host.length === 0) {
				throw new Error(`Invalid REDIS_SENTINELS entry "${s}": host must be non-empty`);
			}
			const port = Number.parseInt(portStr, 10);
			if (!Number.isFinite(port)) {
				throw new Error(`Invalid REDIS_SENTINELS entry "${s}": port must be a finite integer`);
			}
			return { host, port };
		});
}

export function parseBaseRedisEnv(configService: ConfigService): {
	mode: 'direct' | 'sentinel';
	db: number;
	username: string | undefined;
	password: string | undefined;
} {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	if (mode !== 'direct' && mode !== 'sentinel') {
		throw new Error(`Unsupported REDIS_MODE "${mode}": must be "direct" or "sentinel"`);
	}
	const dbStr = configService.get<string>('REDIS_DB', '0');
	const db = Number(dbStr);
	if (!Number.isInteger(db) || db < 0) {
		throw new Error(`Invalid REDIS_DB "${dbStr}": must be a non-negative integer`);
	}
	const username = configService.get<string>('REDIS_USERNAME') || undefined;
	const password = configService.get<string>('REDIS_PASSWORD') || undefined;
	return { mode, db, username, password };
}

export function buildRedisConnection(configService: ConfigService): RedisOptions {
	const { mode, db, username, password } = parseBaseRedisEnv(configService);

	const reconnectOnError = (err: Error) =>
		err.message.includes('NOAUTH') || err.message.includes('WRONGPASS');

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
	const portStr = configService.get<string>('REDIS_PORT', '6379');
	const port = Number(portStr);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid REDIS_PORT "${portStr}": must be an integer between 1 and 65535`);
	}

	return {
		host,
		port,
		db,
		username,
		password,
		reconnectOnError,
	};
}
