import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'node:crypto';

const FETCH_TIMEOUT_MS = 5000;
/**
 * Maximum number of concurrent JWKS reload attempts triggered by unknown-kid
 * events. Keeps one in-flight at a time.
 */
const RELOAD_DEBOUNCE_MS = 5000;

@Injectable()
export class JwksService implements OnModuleInit {
	private readonly logger = new Logger(JwksService.name);
	private keyMap = new Map<string, string>();
	private primaryPem: string | null = null;

	/** Debounce handle – prevents flood of concurrent reload requests. */
	private reloadPromise: Promise<void> | null = null;
	private reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly configService: ConfigService) {}

	async onModuleInit(): Promise<void> {
		try {
			await this.loadPublicKey();
		} catch (error) {
			this.logger.error(`Failed to load ES256 public key at startup: ${(error as Error).message}`);
		}
	}

	async loadPublicKey(): Promise<void> {
		const jwksUri = this.configService.getOrThrow<string>('JWT_JWKS_URL');
		const controller = new AbortController();
		const timeout = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		let response: Response;
		try {
			response = await fetch(jwksUri, { signal: controller.signal });
		} catch (fetchError) {
			const reason =
				(fetchError as Error).name === 'AbortError'
					? `timed out after ${FETCH_TIMEOUT_MS}ms`
					: ((fetchError as Error).message ?? 'Network error');
			throw new Error(`JWKS fetch failed: ${reason}`, { cause: fetchError });
		} finally {
			globalThis.clearTimeout(timeout);
		}

		if (!response.ok) {
			throw new Error(`JWKS endpoint returned HTTP ${response.status}`);
		}

		let document: { keys?: unknown[] };
		try {
			document = (await response.json()) as { keys?: unknown[] };
		} catch (parseError) {
			throw new Error(`Failed to parse JWKS response: ${(parseError as Error).message}`, {
				cause: parseError,
			});
		}

		type EcJwk = {
			kty: string;
			crv?: string;
			use?: string;
			alg?: string;
			x?: string;
			y?: string;
			kid?: string;
		};
		const ecKeys = ((document.keys ?? []) as EcJwk[]).filter(
			(k) => k.kty === 'EC' && k.crv === 'P-256' && (k.use === 'sig' || k.alg === 'ES256') && k.x && k.y
		);

		if (ecKeys.length === 0) {
			throw new Error('No ES256 (EC P-256) key found in JWKS document');
		}

		const newMap = new Map<string, string>();
		for (const ecKey of ecKeys) {
			try {
				const keyObject = createPublicKey({ key: ecKey as any, format: 'jwk' });
				const pem = keyObject.export({ type: 'spki', format: 'pem' }) as string;
				const kid = ecKey.kid ?? 'default';
				newMap.set(kid, pem);
			} catch (importError) {
				this.logger.warn(
					`Skipping unreadable EC key (kid=${ecKey.kid ?? 'none'}): ${(importError as Error).message}`
				);
			}
		}

		if (newMap.size === 0) {
			throw new Error('All EC P-256 keys in JWKS document failed to import');
		}

		this.keyMap = newMap;
		this.primaryPem = newMap.values().next().value ?? null;
		this.logger.log(`ES256 public key(s) loaded successfully from JWKS (${newMap.size} key(s))`);
	}

	getPublicKeyPem(kid?: string): string | null {
		if (kid !== undefined) {
			return this.keyMap.get(kid) ?? null;
		}
		return this.primaryPem;
	}

	isReady(): boolean {
		return this.primaryPem !== null;
	}

	/**
	 * Trigger a bounded, debounced JWKS reload when an unknown kid is encountered.
	 * Multiple concurrent callers share the same in-flight promise (no reload flood).
	 * A new reload is suppressed if one completed within RELOAD_DEBOUNCE_MS.
	 */
	scheduleReloadForUnknownKid(): void {
		if (this.reloadPromise !== null) {
			// A reload is already in progress – skip
			return;
		}

		if (this.reloadDebounceTimer !== null) {
			// A reload completed recently – debounce
			return;
		}

		this.logger.warn('Unknown kid encountered – scheduling bounded JWKS reload');

		this.reloadPromise = this.loadPublicKey()
			.then(() => {
				this.logger.log('JWKS reload after unknown-kid succeeded');
			})
			.catch((err: Error) => {
				this.logger.error(`JWKS reload after unknown-kid failed: ${err.message}`);
			})
			.finally(() => {
				this.reloadPromise = null;
				// Start debounce window to prevent reload flood
				this.reloadDebounceTimer = globalThis.setTimeout(() => {
					this.reloadDebounceTimer = null;
				}, RELOAD_DEBOUNCE_MS);
			});
	}
}
