import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import KeyvRedis from '@keyv/redis';
import { createRedisStore, cacheModuleOptionsFactory } from './cache';

jest.mock('@keyv/redis');

describe('Cache Module', () => {
	let logSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errorSpy: jest.SpyInstance;

	beforeEach(() => {
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('createRedisStore', () => {
		let eventHandlers: Record<string, (...args: any[]) => void>;
		let mockStore: { on: jest.Mock };

		beforeEach(() => {
			eventHandlers = {};
			mockStore = {
				on: jest.fn((event: string, handler: (...args: any[]) => void) => {
					eventHandlers[event] = handler;
				}),
			};
			(KeyvRedis as unknown as jest.Mock).mockReturnValue(mockStore);
		});

		const TEST_URL = 'redis://localhost:6379';

		it('should create a KeyvRedis store with the given URL', () => {
			createRedisStore(TEST_URL);
			expect(KeyvRedis).toHaveBeenCalledWith(TEST_URL);
		});

		it('should register connect, ready, error, close, and reconnecting listeners', () => {
			createRedisStore(TEST_URL);
			const expectedEvents = ['connect', 'ready', 'error', 'close', 'reconnecting'];
			for (const event of expectedEvents) {
				expect(mockStore.on).toHaveBeenCalledWith(event, expect.any(Function));
			}
		});

		it.each([
			['connect', 'log', 'Redis connected (redis://localhost:6379)'],
			['ready', 'log', 'Redis ready'],
			['close', 'warn', 'Redis connection closed'],
			['reconnecting', 'warn', 'Redis reconnecting...'],
		])('should %s on %s event with correct message', (event, level, message) => {
			createRedisStore(TEST_URL);
			eventHandlers[event]();
			const spy = level === 'log' ? logSpy : warnSpy;
			expect(spy).toHaveBeenCalledWith(message);
		});

		it('should log error on error event with Error instance', () => {
			createRedisStore(TEST_URL);
			const error = new Error('Connection refused');
			eventHandlers['error'](error);
			expect(errorSpy).toHaveBeenCalledWith('Redis error: Connection refused', error.stack);
		});

		it('should handle error event with non-Error values', () => {
			createRedisStore(TEST_URL);
			eventHandlers['error']('string error');
			expect(errorSpy).toHaveBeenCalledWith('Redis error: string error', undefined);
		});

		it.each([
			['user:pass format', 'redis://user:secret@redis-host:6379', 'redis://*****@redis-host:6379'],
			['password-only format', 'redis://:mysecret@redis-host:6379', 'redis://*****@redis-host:6379'],
		])('should mask credentials in the logged URL (%s)', (_label, url, maskedUrl) => {
			createRedisStore(url);
			eventHandlers['connect']();
			expect(logSpy).toHaveBeenCalledWith(`Redis connected (${maskedUrl})`);
		});
	});

	describe('cacheModuleOptionsFactory', () => {
		function buildConfigService(overrides: Record<string, any> = {}): ConfigService {
			return {
				get: jest.fn((key: string, fallback: any) => (key in overrides ? overrides[key] : fallback)),
			} as unknown as ConfigService;
		}

		it('should return CacheOptions with default host and port', () => {
			const result = cacheModuleOptionsFactory(buildConfigService());

			expect(result.ttl).toBe(900);
			expect(result.max).toBe(1000);
			expect(result.stores).toHaveLength(1);
			expect(KeyvRedis).toHaveBeenCalledWith('redis://redis:6379/0');
		});

		it.each([
			[
				'configured host and port',
				{ REDIS_HOST: 'custom-host', REDIS_PORT: 6380 },
				'redis://custom-host:6380/0',
			],
			[
				'password in URL',
				{ REDIS_PASSWORD: 's3cret', REDIS_HOST: 'redis', REDIS_PORT: 6379 },
				'redis://:s3cret@redis:6379/0',
			],
			[
				'reserved characters in password',
				{ REDIS_PASSWORD: 'p@ss:w/rd#1?', REDIS_HOST: 'redis', REDIS_PORT: 6379 },
				'redis://:p%40ss%3Aw%2Frd%231%3F@redis:6379/0',
			],
			[
				'non-default REDIS_DB',
				{ REDIS_PASSWORD: 's3cret', REDIS_HOST: 'redis', REDIS_PORT: 6379, REDIS_DB: 2 },
				'redis://:s3cret@redis:6379/2',
			],
		])('should use %s', (_label, overrides, expectedUrl) => {
			cacheModuleOptionsFactory(buildConfigService(overrides));
			expect(KeyvRedis).toHaveBeenCalledWith(expectedUrl);
		});
	});
});
