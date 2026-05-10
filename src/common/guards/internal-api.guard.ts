import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Restreint les routes internes (ex: /api/v1/jobs) aux services pairs
 * qui partagent le secret INTERNAL_API_TOKEN.
 *
 * Appel typique inter-service :
 *   headers['x-internal-token'] = process.env.INTERNAL_API_TOKEN
 *
 * Un JWT utilisateur valide ne suffit PAS pour acceder a ces routes.
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
	private readonly logger = new Logger(InternalApiGuard.name);
	private readonly token: string | undefined;

	constructor(private readonly configService: ConfigService) {
		this.token = this.configService.get<string>('INTERNAL_API_TOKEN');

		if (!this.token) {
			this.logger.warn('INTERNAL_API_TOKEN is not set — all internal routes will be inaccessible');
		}
	}

	canActivate(context: ExecutionContext): boolean {
		if (!this.token) {
			throw new UnauthorizedException('Internal API not configured');
		}

		const request = context.switchToHttp().getRequest<Request>();
		const provided = request.headers['x-internal-token'] as string | undefined;

		if (!provided || provided !== this.token) {
			this.logger.warn('Internal route accessed without valid x-internal-token', {
				path: request.path,
				ip: request.ip,
			});
			throw new UnauthorizedException('Invalid or missing x-internal-token');
		}

		return true;
	}
}
