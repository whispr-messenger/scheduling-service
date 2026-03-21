import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwksService } from './jwks.service';

const ES256_JWK = {
	kty: 'EC',
	use: 'sig',
	alg: 'ES256',
	crv: 'P-256',
	x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
	y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
};

describe('JwksService', () => {
	let service: JwksService;

	const mockConfigService = {
		getOrThrow: jest.fn().mockReturnValue('https://auth-service/.well-known/jwks.json'),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [JwksService, { provide: ConfigService, useValue: mockConfigService }],
		}).compile();

		service = module.get<JwksService>(JwksService);
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Stop any lingering background retry loops
		service.onModuleDestroy();
		jest.restoreAllMocks();
	});

	describe('isReady()', () => {
		it('should return false before the key is loaded', () => {
			expect(service.isReady()).toBe(false);
		});
	});

	describe('getPublicKeyPem()', () => {
		it('should return null before any key is loaded', () => {
			expect(service.getPublicKeyPem()).toBeNull();
		});
	});

	describe('loadPublicKey()', () => {
		it('should load the ES256 public key and mark service as ready', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
			} as unknown as Response);

			await service.loadPublicKey();
			expect(service.isReady()).toBe(true);
			const pem = service.getPublicKeyPem();
			expect(pem).not.toBeNull();
			expect(pem).toMatch(/^-----BEGIN/);
		});

		it('should accept a key with only use=sig (no alg field)', async () => {
			const keyWithUseSig = { ...ES256_JWK, alg: undefined };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyWithUseSig] }),
			} as unknown as Response);

			await service.loadPublicKey();
			expect(service.isReady()).toBe(true);
		});

		it('should accept a key with only alg=ES256 (no use field)', async () => {
			const keyWithAlgOnly = { ...ES256_JWK, use: undefined };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyWithAlgOnly] }),
			} as unknown as Response);

			await service.loadPublicKey();
			expect(service.isReady()).toBe(true);
		});

		it('should throw when fetch fails with a network error', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
			await expect(service.loadPublicKey()).rejects.toThrow('JWKS fetch failed: Network error');
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the fetch times out', async () => {
			const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);
			await expect(service.loadPublicKey()).rejects.toThrow(
				'JWKS fetch failed: timed out after 5000ms'
			);
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the JWKS endpoint returns a non-200 status', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				status: 503,
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow('JWKS endpoint returned HTTP 503');
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the JWKS document contains no EC P-256 key', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [{ kty: 'RSA' }] }),
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the EC key has no use or alg field', async () => {
			const keyNoUseOrAlg = { kty: 'EC', crv: 'P-256', x: ES256_JWK.x, y: ES256_JWK.y };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyNoUseOrAlg] }),
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
		});

		it('should throw when the EC key is missing x/y coordinates', async () => {
			const keyMissingCoords = { kty: 'EC', use: 'sig', alg: 'ES256', crv: 'P-256' };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyMissingCoords] }),
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
		});

		it('should select a key by kid when multiple keys are present', async () => {
			const key1 = { ...ES256_JWK, kid: 'key-1' };
			const key2 = { ...ES256_JWK, kid: 'key-2' };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [key1, key2] }),
			} as unknown as Response);

			await service.loadPublicKey();
			expect(service.isReady()).toBe(true);
			expect(service.getPublicKeyPem('key-1')).not.toBeNull();
			expect(service.getPublicKeyPem('key-2')).not.toBeNull();
			expect(service.getPublicKeyPem('unknown-kid')).toBeNull();
		});

		it('should throw when the JWKS document has an empty keys array', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [] }),
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
		});

		it('should throw when the response body is not valid JSON', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
			} as unknown as Response);
			await expect(service.loadPublicKey()).rejects.toThrow('Failed to parse JWKS response');
		});
	});

	describe('onModuleInit() — retry behaviour', () => {
		let sleepSpy: jest.SpyInstance;

		beforeEach(() => {
			// Mock sleep to resolve immediately so tests don't wait
			sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
		});

		it('should succeed on first attempt without retrying', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey').mockResolvedValue(undefined);
			await service.onModuleInit();
			expect(loadSpy).toHaveBeenCalledTimes(1);
			expect(sleepSpy).not.toHaveBeenCalled();
		});

		it('should retry and succeed after transient failures', async () => {
			const loadSpy = jest
				.spyOn(service, 'loadPublicKey')
				.mockRejectedValueOnce(new Error('fail 1'))
				.mockRejectedValueOnce(new Error('fail 2'))
				.mockResolvedValueOnce(undefined);

			await service.onModuleInit();

			expect(loadSpy).toHaveBeenCalledTimes(3);
			// Two failures → two sleeps (before attempt 2 and before attempt 3)
			expect(sleepSpy).toHaveBeenCalledTimes(2);
			// Verify exponential backoff: 2000, 4000
			expect(sleepSpy).toHaveBeenNthCalledWith(1, 2000);
			expect(sleepSpy).toHaveBeenNthCalledWith(2, 4000);
		});

		it('should use exponential backoff with correct delays', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey');
			// Fail first 2, succeed on 3rd
			loadSpy.mockRejectedValueOnce(new Error('fail 1'));
			loadSpy.mockRejectedValueOnce(new Error('fail 2'));
			loadSpy.mockResolvedValueOnce(undefined);

			await service.onModuleInit();

			expect(loadSpy).toHaveBeenCalledTimes(3);
			// 2 failures → 2 sleeps
			expect(sleepSpy).toHaveBeenCalledTimes(2);
			// Verify the delays: 2000, 4000
			expect(sleepSpy).toHaveBeenNthCalledWith(1, 2000);
			expect(sleepSpy).toHaveBeenNthCalledWith(2, 4000);
		});

		it('should abort retries when module is destroyed', async () => {
			const loadSpy = jest
				.spyOn(service, 'loadPublicKey')
				.mockRejectedValueOnce(new Error('fail 1'))
				.mockRejectedValueOnce(new Error('fail 2'))
				.mockResolvedValue(undefined);

			// Destroy the module during the second sleep
			sleepSpy.mockImplementation(async () => {
				(service as any)._destroyed = true;
			});

			await service.onModuleInit();

			// Should have tried once, failed, then during sleep _destroyed was set,
			// so it should stop before trying again
			expect(loadSpy).toHaveBeenCalledTimes(1);
			expect(service.isReady()).toBe(false);
		});

		it('should start background retry after all attempts are exhausted', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey');
			// Fail all 3 attempts
			for (let i = 0; i < 3; i++) {
				loadSpy.mockRejectedValueOnce(new Error(`fail ${i + 1}`));
			}
			// Background retry will succeed on first try and set primaryPem
			loadSpy.mockImplementationOnce(async () => {
				(service as any).primaryPem = 'fake-pem';
			});

			const bgSpy = jest.spyOn(service as any, 'continueBackgroundRetry');

			await service.onModuleInit();

			expect(bgSpy).toHaveBeenCalledTimes(1);

			// Let background retry microtask settle
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			// 3 failed attempts + 1 successful background retry
			expect(loadSpy).toHaveBeenCalledTimes(4);
			expect(service.isReady()).toBe(true);
		});
	});

	describe('continueBackgroundRetry()', () => {
		let sleepSpy: jest.SpyInstance;

		beforeEach(() => {
			sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
		});

		it('should keep retrying until loadPublicKey succeeds', async () => {
			const loadSpy = jest
				.spyOn(service, 'loadPublicKey')
				.mockRejectedValueOnce(new Error('bg fail 1'))
				.mockRejectedValueOnce(new Error('bg fail 2'))
				.mockImplementation(async () => {
					// Simulate success by setting primaryPem so isReady() returns true
					(service as any).primaryPem = 'fake-pem';
				});

			(service as any).continueBackgroundRetry();

			// Let all microtasks flush
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(loadSpy).toHaveBeenCalledTimes(3);
			expect(sleepSpy).toHaveBeenCalledWith(30000);
			expect(service.isReady()).toBe(true);
		});

		it('should stop when module is destroyed', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey').mockRejectedValue(new Error('fail'));

			// Destroy after one sleep
			let callCount = 0;
			sleepSpy.mockImplementation(async () => {
				callCount++;
				if (callCount >= 2) {
					(service as any)._destroyed = true;
				}
			});

			(service as any).continueBackgroundRetry();

			// Flush microtasks
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			// Should have stopped after _destroyed was set
			expect(loadSpy.mock.calls.length).toBeLessThanOrEqual(2);
		});

		it('should skip fetch if key was loaded by another path during sleep', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey');

			// Simulate key becoming ready during the sleep
			sleepSpy.mockImplementation(async () => {
				(service as any).primaryPem = 'loaded-by-another-path';
			});

			(service as any).continueBackgroundRetry();

			// Flush microtasks
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			// loadPublicKey should never be called — isReady() was true after sleep
			expect(loadSpy).not.toHaveBeenCalled();
		});
	});

	describe('onModuleDestroy()', () => {
		it('should set _destroyed flag to true', () => {
			expect((service as any)._destroyed).toBe(false);
			service.onModuleDestroy();
			expect((service as any)._destroyed).toBe(true);
		});

		it('should clear pending timers and debounce timer', () => {
			const clearSpy = jest.spyOn(globalThis, 'clearTimeout');

			// Simulate a pending timer
			const fakeHandle = globalThis.setTimeout(() => {}, 99999);
			(service as any).pendingTimers.add(fakeHandle);

			// Simulate a debounce timer
			const debounceHandle = globalThis.setTimeout(() => {}, 99999);
			(service as any).reloadDebounceTimer = debounceHandle;

			service.onModuleDestroy();

			expect(clearSpy).toHaveBeenCalledWith(fakeHandle);
			expect(clearSpy).toHaveBeenCalledWith(debounceHandle);
			expect((service as any).pendingTimers.size).toBe(0);
			expect((service as any).reloadDebounceTimer).toBeNull();
		});
	});

	describe('scheduleReloadForUnknownKid()', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should trigger a reload when an unknown kid is encountered', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey').mockResolvedValue(undefined);

			service.scheduleReloadForUnknownKid();

			// Allow microtasks to settle
			await Promise.resolve();

			expect(loadSpy).toHaveBeenCalledTimes(1);
		});

		it('should not trigger multiple concurrent reloads (debounce concurrent requests)', async () => {
			let resolveReload!: () => void;
			const slowReload = new Promise<void>((resolve) => {
				resolveReload = resolve;
			});
			const loadSpy = jest.spyOn(service, 'loadPublicKey').mockReturnValue(slowReload);

			// First call — starts reload
			service.scheduleReloadForUnknownKid();
			// Second call while reload in progress — should be a no-op
			service.scheduleReloadForUnknownKid();
			service.scheduleReloadForUnknownKid();

			resolveReload();
			await Promise.resolve();

			expect(loadSpy).toHaveBeenCalledTimes(1);
		});

		it('should suppress further reloads during debounce window after a successful reload', async () => {
			const loadSpy = jest.spyOn(service, 'loadPublicKey').mockResolvedValue(undefined);

			service.scheduleReloadForUnknownKid();
			// Flush microtasks so the mock resolved value settles and finally() runs
			await Promise.resolve();
			await Promise.resolve();

			// Second call within debounce window should be no-op
			service.scheduleReloadForUnknownKid();
			await Promise.resolve();

			expect(loadSpy).toHaveBeenCalledTimes(1);

			// After debounce window expires (RELOAD_DEBOUNCE_MS = 5000 ms), a new reload is allowed
			jest.advanceTimersByTime(6000);
			service.scheduleReloadForUnknownKid();
			await Promise.resolve();
			await Promise.resolve();

			expect(loadSpy).toHaveBeenCalledTimes(2);
		});

		it('should handle reload failure gracefully and allow retry after debounce', async () => {
			const loadSpy = jest
				.spyOn(service, 'loadPublicKey')
				.mockRejectedValueOnce(new Error('JWKS reload failed'))
				.mockResolvedValue(undefined);

			service.scheduleReloadForUnknownKid();
			// Flush enough microtask ticks for the rejection and finally() to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			// Debounce window is now active — immediate retry should be a no-op
			service.scheduleReloadForUnknownKid();
			await Promise.resolve();
			expect(loadSpy).toHaveBeenCalledTimes(1);

			// After debounce expires, retry is allowed
			jest.advanceTimersByTime(6000);
			service.scheduleReloadForUnknownKid();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(loadSpy).toHaveBeenCalledTimes(2);
		});
	});
});
