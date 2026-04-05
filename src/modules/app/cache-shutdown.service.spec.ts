import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { CacheShutdownService } from './cache-shutdown.service';

const mockCacheManager = {
	disconnect: jest.fn(),
};

describe('CacheShutdownService', () => {
	let service: CacheShutdownService;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockCacheManager.disconnect.mockResolvedValue(undefined);

		const module = await Test.createTestingModule({
			providers: [CacheShutdownService, { provide: CACHE_MANAGER, useValue: mockCacheManager }],
		}).compile();

		service = module.get<CacheShutdownService>(CacheShutdownService);
	});

	it('should call cacheManager.disconnect() on module destroy', async () => {
		await service.onModuleDestroy();
		expect(mockCacheManager.disconnect).toHaveBeenCalledTimes(1);
	});

	it('should not throw when disconnect rejects', async () => {
		mockCacheManager.disconnect.mockRejectedValue(new Error('connection lost'));
		await expect(service.onModuleDestroy()).resolves.toBeUndefined();
	});

	it('should not throw when disconnect exceeds the timeout', async () => {
		jest.useFakeTimers();
		mockCacheManager.disconnect.mockImplementation(() => new Promise(() => {}));

		const promise = service.onModuleDestroy();
		jest.advanceTimersByTime(5_000);
		await expect(promise).resolves.toBeUndefined();

		jest.useRealTimers();
	});
});
