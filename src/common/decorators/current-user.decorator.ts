import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
	userId: string;
	jti: string;
	deviceId: string;
	fingerprint?: string;
}

/**
 * Recupere l'identite authentifiee posee par le JwtAuthGuard sur la requete.
 * Utiliser systematiquement plutot que de lire userId depuis la query/body
 * (sinon: IDOR direct, un user peut manipuler les ressources d'un autre).
 */
export const CurrentUser = createParamDecorator(
	(data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
		const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
		const user = request.user;

		if (!user || !user.userId) {
			throw new UnauthorizedException();
		}

		return data ? user[data] : user;
	}
);
