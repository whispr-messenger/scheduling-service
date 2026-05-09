import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Tolerance de 5 minutes de chaque cote pour absorber la derive d'horloge
 * entre le sender et le receiver sans ouvrir une fenetre de replay trop large.
 */
const TIMESTAMP_TOLERANCE_S = 300;

/** Format du header signature : t=<epoch>,v1=<hex> */
const SIGNATURE_REGEX = /^t=(\d+),v1=([0-9a-f]+)$/;

export interface WebhookHeaders {
	/** epoch seconds en string */
	'x-whispr-timestamp': string;
	/** t=<ts>,v1=<hmac-sha256-hex> */
	'x-whispr-signature': string;
}

@Injectable()
export class WebhookHmacService {
	private readonly logger = new Logger(WebhookHmacService.name);
	private readonly secret: string;

	constructor(private readonly configService: ConfigService) {
		const secret = this.configService.get<string>('WEBHOOK_HMAC_SECRET');
		if (!secret) {
			// Fail-closed en prod : le service refuse de demarrer sans le secret.
			// En test l'env var est injectee directement dans ConfigService.
			throw new Error('WEBHOOK_HMAC_SECRET is required but not set');
		}
		this.secret = secret;
	}

	/**
	 * Genere les headers HMAC pour un appel HTTP sortant.
	 *
	 * La signature couvre `${timestamp}.${body}` pour lier le timestamp
	 * au corps du message et empecher une attaque de substitution.
	 *
	 * @param body corps brut (JSON string) qui sera envoye dans la requete
	 * @param nowSeconds epoch seconds (injectable pour les tests)
	 */
	sign(body: string, nowSeconds: number = Math.floor(Date.now() / 1000)): WebhookHeaders {
		const payload = `${nowSeconds}.${body}`;
		const digest = createHmac('sha256', this.secret).update(payload, 'utf8').digest('hex');

		return {
			'x-whispr-timestamp': String(nowSeconds),
			'x-whispr-signature': `t=${nowSeconds},v1=${digest}`,
		};
	}

	/**
	 * Verifie la signature d'un webhook entrant.
	 *
	 * Retourne true uniquement si :
	 *  - le header suit le format t=<ts>,v1=<hex>
	 *  - le timestamp est dans la tolerance de +/-5 min
	 *  - la signature correspond au HMAC recalcule sur `${ts}.${body}`
	 *
	 * La comparaison est realisee en temps constant (timingSafeEqual)
	 * pour prevenir les attaques de type timing.
	 *
	 * @param body corps brut tel que recu (avant JSON.parse)
	 * @param signatureHeader valeur du header X-Whispr-Signature
	 * @param nowSeconds epoch seconds courant (injectable pour les tests)
	 */
	verify(
		body: string,
		signatureHeader: string,
		nowSeconds: number = Math.floor(Date.now() / 1000)
	): boolean {
		const match = SIGNATURE_REGEX.exec(signatureHeader);
		if (!match) {
			this.logger.warn('Webhook rejected: signature header format invalid', { signatureHeader });
			return false;
		}

		const [, tsStr, receivedHex] = match;
		const ts = parseInt(tsStr, 10);

		const delta = Math.abs(nowSeconds - ts);
		if (delta >= TIMESTAMP_TOLERANCE_S) {
			this.logger.warn('Webhook rejected: timestamp out of tolerance', { ts, nowSeconds, delta });
			return false;
		}

		const expectedDigest = createHmac('sha256', this.secret)
			.update(`${ts}.${body}`, 'utf8')
			.digest('hex');

		// timingSafeEqual attend des Buffer de meme longueur.
		const expectedBuf = Buffer.from(expectedDigest, 'hex');
		const receivedBuf = Buffer.from(receivedHex, 'hex');

		if (expectedBuf.length !== receivedBuf.length) {
			this.logger.warn('Webhook rejected: digest length mismatch');
			return false;
		}

		const valid = timingSafeEqual(expectedBuf, receivedBuf);
		if (!valid) {
			this.logger.warn('Webhook rejected: signature mismatch');
		}
		return valid;
	}
}
