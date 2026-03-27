import { Test } from '@nestjs/testing';
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
		const module = await Test.createTestingModule({
			providers: [JwksService, { provide: ConfigService, useValue: mockConfigService }],
		}).compile();

		service = module.get<JwksService>(JwksService);
		jest.clearAllMocks();
	});

	afterEach(() => {
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

	describe('onModuleInit()', () => {
		it('should call loadPublicKey on module init', async () => {
			const spy = jest.spyOn(service, 'loadPublicKey').mockResolvedValue(undefined);
			await service.onModuleInit();
			expect(spy).toHaveBeenCalledTimes(1);
		});

		it('should not throw when loadPublicKey fails at startup — keeps service not ready', async () => {
			jest.spyOn(service, 'loadPublicKey').mockRejectedValue(new Error('JWKS unreachable'));
			await expect(service.onModuleInit()).resolves.toBeUndefined();
			expect(service.isReady()).toBe(false);
		});

		it('should recover after startup failure when loadPublicKey succeeds later', async () => {
			// Simulate startup failure
			jest.spyOn(service, 'loadPublicKey').mockRejectedValueOnce(new Error('JWKS unreachable'));
			await service.onModuleInit();
			expect(service.isReady()).toBe(false);

			// Simulate successful reload triggered later
			jest.spyOn(service, 'loadPublicKey').mockResolvedValueOnce(undefined);
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
			} as unknown as Response);

			await service.loadPublicKey();
			// After manual reload succeeds, service should still function
			expect(service.loadPublicKey).toHaveBeenCalled();
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
