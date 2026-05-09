import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { WebhookHmacService } from './webhook-hmac.service';

/**
 * Guard a appliquer sur les endpoints qui recoivent des callbacks webhook
 * de services internes (ex: notification-service, media-service).
 *
 * Utilisation : @UseGuards(WebhookHmacGuard) sur un controller ou une route.
 *
 * Prerequis : le body doit etre lisible en string brut. Configurer rawBody
 * dans NestJS main.ts si besoin (app.use(express.raw({ type: 'application/json' }))).
 */
@Injectable()
export class WebhookHmacGuard implements CanActivate {
	private readonly logger = new Logger(WebhookHmacGuard.name);

	constructor(private readonly hmac: WebhookHmacService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

		const signatureHeader = request.headers['x-whispr-signature'] as string | undefined;
		if (!signatureHeader) {
			this.logger.warn('Webhook request missing X-Whispr-Signature header', {
				path: request.path,
				ip: request.ip,
			});
			throw new UnauthorizedException('Missing X-Whispr-Signature header');
		}

		// On prefere rawBody (buffer brut) quand disponible pour eviter toute
		// re-serialisation JSON qui changerait l'ordre des cles ou l'espacement.
		const body: string =
			request.rawBody != null ? request.rawBody.toString('utf8') : JSON.stringify(request.body ?? {});

		const valid = this.hmac.verify(body, signatureHeader);
		if (!valid) {
			this.logger.warn('Webhook request rejected: invalid or replayed signature', {
				path: request.path,
				ip: request.ip,
			});
			throw new UnauthorizedException('Invalid or replayed webhook signature');
		}

		return true;
	}
}
