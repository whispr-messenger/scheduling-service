import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { Request } from 'express';
import { JwksService } from '../jwks/jwks.service';
import { IS_PUBLIC_KEY } from './public.decorator';

interface JwtPayload {
	sub: string;
	jti: string;
	deviceId: string;
	fingerprint?: string;
	[key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
	private readonly logger = new Logger(JwtAuthGuard.name);
	/** Suppress repeated "key not loaded" warnings; log only once until the key loads. */
	private keyNotLoadedWarned = false;

	constructor(
		private readonly jwksService: JwksService,
		private readonly jwtService: JwtService,
		private readonly reflector: Reflector,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const token = this.extractBearerToken(request);

		if (!token) {
			throw new UnauthorizedException();
		}

		// Peek the kid from the JWT header (unverified) to select the right key.
		const kid = this.peekKid(token);
		let publicKeyPem = this.jwksService.getPublicKeyPem(kid ?? undefined);

		if (!publicKeyPem && kid !== null) {
			// Unknown kid: trigger a bounded reload and reject this request
			this.jwksService.scheduleReloadForUnknownKid();
			if (!this.keyNotLoadedWarned) {
				this.logger.warn(
					`Unknown kid '${kid}' — JWKS reload scheduled; rejecting request (further warnings suppressed until key loads)`
				);
				this.keyNotLoadedWarned = true;
			}
			throw new UnauthorizedException();
		}

		if (!publicKeyPem) {
			if (!this.keyNotLoadedWarned) {
				this.logger.warn(
					'Public key not loaded — rejecting request (further warnings suppressed until key loads)'
				);
				this.keyNotLoadedWarned = true;
			}
			throw new UnauthorizedException();
		}

		// Key is loaded — reset the flag so we log again if the key is ever evicted.
		this.keyNotLoadedWarned = false;

		let payload: JwtPayload;
		try {
			payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
				publicKey: publicKeyPem,
				algorithms: ['ES256'],
			});
		} catch (error) {
			this.logger.debug(`JWT verification failed: ${(error as Error).message}`);
			throw new UnauthorizedException();
		}

		const { sub, jti, deviceId, fingerprint } = payload;

		if (!sub || !jti || !deviceId) {
			throw new UnauthorizedException();
		}

		const [tokenRevoked, deviceRevoked] = await Promise.all([
			this.cacheManager.get<string>(`revoked:${jti}`),
			this.cacheManager.get<string>(`revoked_device:${deviceId}`),
		]);

		if (tokenRevoked !== undefined && tokenRevoked !== null) {
			throw new UnauthorizedException();
		}
		if (deviceRevoked !== undefined && deviceRevoked !== null) {
			throw new UnauthorizedException();
		}

		(request as Request & { user: unknown }).user = { userId: sub, jti, deviceId, fingerprint };
		return true;
	}

	private extractBearerToken(request: Request): string | null {
		const authHeader = request.headers.authorization;
		if (!authHeader) return null;
		// Case-insensitive match for the Bearer scheme (RFC 7235 allows any case).
		const match = authHeader.match(/^bearer\s+(.+)$/i);
		return match ? match[1] : null;
	}

	/** Reads the `kid` field from the JWT header without verifying the token. */
	private peekKid(token: string): string | null {
		try {
			const [headerB64] = token.split('.');
			const json = Buffer.from(headerB64, 'base64url').toString('utf8');
			const header = JSON.parse(json) as Record<string, unknown>;
			return typeof header['kid'] === 'string' ? header['kid'] : null;
		} catch {
			return null;
		}
	}
}
