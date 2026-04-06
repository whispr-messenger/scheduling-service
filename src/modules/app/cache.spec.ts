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

		it('should create a KeyvRedis store with the given URL', () => {
			createRedisStore('redis://localhost:6379');
			expect(KeyvRedis).toHaveBeenCalledWith('redis://localhost:6379');
		});

		it('should register connect, ready, error, close, and reconnecting listeners', () => {
			createRedisStore('redis://localhost:6379');
			expect(mockStore.on).toHaveBeenCalledWith('connect', expect.any(Function));
			expect(mockStore.on).toHaveBeenCalledWith('ready', expect.any(Function));
			expect(mockStore.on).toHaveBeenCalledWith('error', expect.any(Function));
			expect(mockStore.on).toHaveBeenCalledWith('close', expect.any(Function));
			expect(mockStore.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
		});

		it('should log on connect event', () => {
			createRedisStore('redis://localhost:6379');
			eventHandlers['connect']();
			expect(logSpy).toHaveBeenCalledWith('Redis connected (redis://localhost:6379)');
		});

		it('should log on ready event', () => {
			createRedisStore('redis://localhost:6379');
			eventHandlers['ready']();
			expect(logSpy).toHaveBeenCalledWith('Redis ready');
		});

		it('should log error on error event', () => {
			createRedisStore('redis://localhost:6379');
			const error = new Error('Connection refused');
			eventHandlers['error'](error);
			expect(errorSpy).toHaveBeenCalledWith('Redis error: Connection refused', error.stack);
		});

		it('should handle error event with non-Error values', () => {
			createRedisStore('redis://localhost:6379');
			eventHandlers['error']('string error');
			expect(errorSpy).toHaveBeenCalledWith('Redis error: string error', undefined);
		});

		it('should warn on close event', () => {
			createRedisStore('redis://localhost:6379');
			eventHandlers['close']();
			expect(warnSpy).toHaveBeenCalledWith('Redis connection closed');
		});

		it('should warn on reconnecting event', () => {
			createRedisStore('redis://localhost:6379');
			eventHandlers['reconnecting']();
			expect(warnSpy).toHaveBeenCalledWith('Redis reconnecting...');
		});

		it('should mask credentials in the logged URL (user:pass format)', () => {
			createRedisStore('redis://user:secret@redis-host:6379');
			eventHandlers['connect']();
			expect(logSpy).toHaveBeenCalledWith('Redis connected (redis://*****@redis-host:6379)');
		});

		it('should mask credentials in the logged URL (password-only format)', () => {
			createRedisStore('redis://:mysecret@redis-host:6379');
			eventHandlers['connect']();
			expect(logSpy).toHaveBeenCalledWith('Redis connected (redis://*****@redis-host:6379)');
		});
	});

	describe('cacheModuleOptionsFactory', () => {
		it('should return CacheOptions with default host and port', () => {
			const configService = {
				get: jest.fn((key: string, fallback: any) => fallback),
			} as unknown as ConfigService;

			const result = cacheModuleOptionsFactory(configService);

			expect(result.ttl).toBe(900);
			expect(result.max).toBe(1000);
			expect(result.stores).toHaveLength(1);
			expect(KeyvRedis).toHaveBeenCalledWith('redis://redis:6379/0');
		});

		it('should use configured host and port from ConfigService', () => {
			const configService = {
				get: jest.fn((key: string, fallback: any) => {
					if (key === 'REDIS_HOST') return 'custom-host';
					if (key === 'REDIS_PORT') return 6380;
					return fallback;
				}),
			} as unknown as ConfigService;

			cacheModuleOptionsFactory(configService);

			expect(KeyvRedis).toHaveBeenCalledWith('redis://custom-host:6380/0');
		});

		it('should include password in URL when REDIS_PASSWORD is set', () => {
			const configService = {
				get: jest.fn((key: string, fallback?: any) => {
					if (key === 'REDIS_PASSWORD') return 's3cret';
					if (key === 'REDIS_HOST') return 'redis';
					if (key === 'REDIS_PORT') return 6379;
					return fallback;
				}),
			} as unknown as ConfigService;

			cacheModuleOptionsFactory(configService);

			expect(KeyvRedis).toHaveBeenCalledWith('redis://:s3cret@redis:6379/0');
		});

		it('should include REDIS_DB in URL when set to non-default value', () => {
			const configService = {
				get: jest.fn((key: string, fallback?: any) => {
					if (key === 'REDIS_PASSWORD') return 's3cret';
					if (key === 'REDIS_HOST') return 'redis';
					if (key === 'REDIS_PORT') return 6379;
					if (key === 'REDIS_DB') return 2;
					return fallback;
				}),
			} as unknown as ConfigService;

			cacheModuleOptionsFactory(configService);

			expect(KeyvRedis).toHaveBeenCalledWith('redis://:s3cret@redis:6379/2');
		});
	});
});
