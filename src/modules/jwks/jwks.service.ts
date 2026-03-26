import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, type JsonWebKey as CryptoJsonWebKey } from 'node:crypto';

const FETCH_TIMEOUT_MS = 5000;
/**
 * Maximum number of concurrent JWKS reload attempts triggered by unknown-kid
 * events. Keeps one in-flight at a time.
 */
const RELOAD_DEBOUNCE_MS = 5000;

/** Retry constants for startup JWKS fetch — short budget to avoid blocking init */
const BACKOFF_INITIAL_MS = 2_000;
const BACKOFF_MAX_ATTEMPTS = 3;

/** Background retry interval after startup attempts are exhausted */
const BACKGROUND_RETRY_MS = 30_000;

/** Subset of the crypto.JsonWebKey interface that we care about for EC P-256 keys. */
interface EcJwkKey extends CryptoJsonWebKey {
	kid?: string;
}

interface JwksDocument {
	keys: EcJwkKey[];
}

@Injectable()
export class JwksService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(JwksService.name);
	/** Map of kid -> PEM string.  "default" is used when a key has no kid. */
	private keyMap: Map<string, string> = new Map();
	/** Cached PEM for the primary (first loaded) key — for guards that don't need kid routing. */
	private primaryPem: string | null = null;

	/** Debounce handle – prevents flood of concurrent reload requests. */
	private reloadPromise: Promise<void> | null = null;
	private reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	/** Pending timer handles — cleared on destroy to avoid dangling callbacks. */
	private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();

	/** Set to true when the module is destroyed to stop background retries. */
	private _destroyed = false;

	constructor(private readonly configService: ConfigService) {}

	async onModuleInit(): Promise<void> {
		await this.loadPublicKeyWithRetry();
	}

	onModuleDestroy(): void {
		this._destroyed = true;
		for (const handle of this.pendingTimers) {
			globalThis.clearTimeout(handle);
		}
		this.pendingTimers.clear();
		if (this.reloadDebounceTimer !== null) {
			globalThis.clearTimeout(this.reloadDebounceTimer);
			this.reloadDebounceTimer = null;
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
			// eslint-disable-next-line preserve-caught-error
			throw new Error(`JWKS fetch failed: ${reason}`);
		} finally {
			globalThis.clearTimeout(timeout);
		}

		if (!response.ok) {
			throw new Error(`JWKS endpoint returned HTTP ${response.status}`);
		}

		let document: JwksDocument;
		try {
			document = (await response.json()) as JwksDocument;
		} catch (parseError) {
			// eslint-disable-next-line preserve-caught-error
			throw new Error(`Failed to parse JWKS response: ${(parseError as Error).message}`);
		}

		const ecKeys = (document.keys ?? []).filter(
			(k) => k.kty === 'EC' && k.crv === 'P-256' && (k.use === 'sig' || k.alg === 'ES256') && k.x && k.y
		);

		if (ecKeys.length === 0) {
			throw new Error('No ES256 (EC P-256) key found in JWKS document');
		}

		const newMap = new Map<string, string>();
		for (const ecKey of ecKeys) {
			try {
				const keyObject = createPublicKey({ key: ecKey as CryptoJsonWebKey, format: 'jwk' });
				const pem = keyObject.export({ type: 'spki', format: 'pem' }) as string;
				const kid = ecKey.kid ?? 'default';
				newMap.set(kid, pem);
			} catch (importError) {
				this.logger.warn(`Skipping unreadable EC key (kid=${ecKey.kid ?? 'none'}): ${(importError as Error).message}`);
			}
		}

		if (newMap.size === 0) {
			throw new Error('All EC P-256 keys in JWKS document failed to import');
		}

		this.keyMap = newMap;
		this.primaryPem = newMap.values().next().value ?? null;
		this.logger.log(`ES256 public key(s) loaded successfully from JWKS (${newMap.size} key(s))`);
	}

	private async loadPublicKeyWithRetry(): Promise<void> {
		let delay = BACKOFF_INITIAL_MS;
		for (let attempt = 1; attempt <= BACKOFF_MAX_ATTEMPTS; attempt++) {
			try {
				await this.loadPublicKey();
				this.logger.log('JWKS public key loaded successfully');
				return;
			} catch (error) {
				this.logger.error(
					`JWKS load attempt ${attempt}/${BACKOFF_MAX_ATTEMPTS} failed: ${(error as Error).message}`
				);
				if (this._destroyed) {
					this.logger.warn('Module destroyed — aborting JWKS retry');
					return;
				}
				if (attempt < BACKOFF_MAX_ATTEMPTS) {
					await this.sleep(delay);
					delay = delay * 2;
				}
			}
			if (this._destroyed) {
				this.logger.warn('Module destroyed — aborting JWKS retry');
				return;
			}
		}
		this.logger.error(
			`JWKS load failed after ${BACKOFF_MAX_ATTEMPTS} attempts — continuing background retry every ${BACKGROUND_RETRY_MS / 1000}s`
		);
		this.continueBackgroundRetry();
	}

	private continueBackgroundRetry(): void {
		const loop = async (): Promise<void> => {
			while (!this.isReady() && !this._destroyed) {
				await this.sleep(BACKGROUND_RETRY_MS);
				if (this._destroyed || this.isReady()) break;
				try {
					await this.loadPublicKey();
					this.logger.log('JWKS background retry succeeded');
				} catch (error) {
					this.logger.error(`JWKS background retry failed: ${(error as Error).message}`);
				}
			}
		};
		void loop();
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			const handle = globalThis.setTimeout(() => {
				this.pendingTimers.delete(handle);
				resolve();
			}, ms);
			if (typeof handle === 'object' && 'unref' in handle) {
				handle.unref();
			}
			this.pendingTimers.add(handle);
		});
	}

	/**
	 * Returns the PEM for the given kid, or the primary PEM if kid is undefined.
	 * Returns null if no keys are loaded.
	 */
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
