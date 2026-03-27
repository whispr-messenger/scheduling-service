import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwksService } from '../jwks/jwks.service';

const mockJwksService = {
	getPublicKeyPem: jest.fn(),
	scheduleReloadForUnknownKid: jest.fn(),
};

const mockJwtService = {
	verifyAsync: jest.fn(),
};

const mockCacheManager = {
	get: jest.fn(),
};

const mockReflector = {
	getAllAndOverride: jest.fn(),
};

const MOCK_PUBLIC_KEY_PEM = '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----';

const VALID_PAYLOAD = {
	sub: 'user-uuid-1',
	jti: 'token-jti-1',
	deviceId: 'device-id-1',
	fingerprint: 'fp-abc',
};

// Build a minimal JWT header with an optional kid
function buildTokenWithKid(kid?: string): string {
	const header = kid ? { alg: 'ES256', kid } : { alg: 'ES256' };
	const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
	return `${headerB64}.payload.sig`;
}

function buildContext(authHeader?: string, handler = {}, cls = {}) {
	const request: { headers: Record<string, string>; user?: unknown } = {
		headers: authHeader ? { authorization: authHeader } : {},
	};
	return {
		switchToHttp: () => ({
			getRequest: () => request,
		}),
		getHandler: () => handler,
		getClass: () => cls,
	};
}

describe('JwtAuthGuard', () => {
	let guard: JwtAuthGuard;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockJwksService.getPublicKeyPem.mockReturnValue(MOCK_PUBLIC_KEY_PEM);
		mockJwtService.verifyAsync.mockResolvedValue(VALID_PAYLOAD);
		mockCacheManager.get.mockResolvedValue(null);
		mockReflector.getAllAndOverride.mockReturnValue(false);

		const module = await Test.createTestingModule({
			providers: [
				JwtAuthGuard,
				{ provide: JwksService, useValue: mockJwksService },
				{ provide: JwtService, useValue: mockJwtService },
				{ provide: Reflector, useValue: mockReflector },
				{ provide: CACHE_MANAGER, useValue: mockCacheManager },
			],
		}).compile();

		guard = module.get<JwtAuthGuard>(JwtAuthGuard);
	});

	it('should allow a request with a valid token and no revocation', async () => {
		const ctx = buildContext('Bearer valid-token');
		const result = await guard.canActivate(ctx as never);
		expect(result).toBe(true);
	});

	it('should skip auth and return true for @Public() routes', async () => {
		mockReflector.getAllAndOverride.mockReturnValue(true);
		const ctx = buildContext(undefined);
		const result = await guard.canActivate(ctx as never);
		expect(result).toBe(true);
	});

	it('should inject user context into the request', async () => {
		const request = { headers: { authorization: 'Bearer valid-token' } } as {
			headers: Record<string, string>;
			user?: unknown;
		};
		const ctx = {
			switchToHttp: () => ({ getRequest: () => request }),
			getHandler: () => ({}),
			getClass: () => ({}),
		};
		await guard.canActivate(ctx as never);
		expect(request.user).toEqual({
			userId: VALID_PAYLOAD.sub,
			jti: VALID_PAYLOAD.jti,
			deviceId: VALID_PAYLOAD.deviceId,
			fingerprint: VALID_PAYLOAD.fingerprint,
		});
	});

	it('should throw 401 when Authorization header is missing', async () => {
		const ctx = buildContext(undefined);
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when Authorization header does not start with Bearer', async () => {
		const ctx = buildContext('Basic dXNlcjpwYXNz');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when public key is not loaded (no kid in token)', async () => {
		mockJwksService.getPublicKeyPem.mockReturnValue(null);
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 and trigger scheduleReloadForUnknownKid when kid is unknown', async () => {
		mockJwksService.getPublicKeyPem.mockImplementation((kid?: string) => {
			if (kid === 'unknown-kid') return null;
			return MOCK_PUBLIC_KEY_PEM;
		});

		const token = buildTokenWithKid('unknown-kid');
		const ctx = buildContext(`Bearer ${token}`);
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
		expect(mockJwksService.scheduleReloadForUnknownKid).toHaveBeenCalledTimes(1);
	});

	it('should throw 401 when JWT verification fails', async () => {
		mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
		const ctx = buildContext('Bearer bad-token');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when payload is missing required fields', async () => {
		mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when token jti is revoked in Redis', async () => {
		mockCacheManager.get.mockImplementation((key: string) => {
			if (key === `revoked:${VALID_PAYLOAD.jti}`) return Promise.resolve('1');
			return Promise.resolve(null);
		});
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when device is revoked in Redis', async () => {
		mockCacheManager.get.mockImplementation((key: string) => {
			if (key === `revoked_device:${VALID_PAYLOAD.deviceId}`) return Promise.resolve('1');
			return Promise.resolve(null);
		});
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should check both revoked:{jti} and revoked_device:{deviceId} in Redis', async () => {
		const ctx = buildContext('Bearer valid-token');
		await guard.canActivate(ctx as never);
		expect(mockCacheManager.get).toHaveBeenCalledWith(`revoked:${VALID_PAYLOAD.jti}`);
		expect(mockCacheManager.get).toHaveBeenCalledWith(`revoked_device:${VALID_PAYLOAD.deviceId}`);
	});

	it('should allow when fingerprint is absent from payload', async () => {
		const { fingerprint: _fp, ...payloadWithoutFingerprint } = VALID_PAYLOAD;
		mockJwtService.verifyAsync.mockResolvedValue(payloadWithoutFingerprint);
		const ctx = buildContext('Bearer valid-token');
		const result = await guard.canActivate(ctx as never);
		expect(result).toBe(true);
	});
});
