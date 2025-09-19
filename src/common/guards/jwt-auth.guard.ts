import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    try {
      // Extraire le token JWT
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('Token d\'authentification requis');
      }

      // Valider le token
      const payload = await this.validateToken(token);
      
      // Ajouter les informations utilisateur à la requête
      request['user'] = payload;
      request['userId'] = payload.sub;
      request['deviceId'] = payload.device_id;
      
      // Log de sécurité
      this.logAuthSuccess(request, payload);
      
      return true;
    } catch (error) {
      this.logAuthFailure(request, error);
      throw new UnauthorizedException(this.getErrorMessage(error));
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ') ?? [];
    
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Format d\'en-tête d\'autorisation invalide');
    }

    return token;
  }

  private async validateToken(token: string): Promise<any> {
    try {
      // Vérifier et décoder le token JWT
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
        issuer: 'auth-service',
        audience: ['scheduling-service', 'whispr-services'],
      });

      // Vérifications supplémentaires
      this.validateTokenClaims(payload);
      
      // Vérifier si le token n'est pas révoqué (optionnel)
      await this.checkTokenRevocation(payload.jti);

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expiré');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token invalide');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token pas encore valide');
      }
      
      throw error;
    }
  }

  private validateTokenClaims(payload: any): void {
    const now = Math.floor(Date.now() / 1000);
    
    // Vérifier les claims obligatoires
    if (!payload.sub) {
      throw new UnauthorizedException('Token invalide: subject manquant');
    }
    
    if (!payload.iat) {
      throw new UnauthorizedException('Token invalide: issued at manquant');
    }
    
    if (!payload.exp) {
      throw new UnauthorizedException('Token invalide: expiration manquante');
    }

    // Vérifier que le token n'est pas trop ancien (protection contre replay)
    const maxAge = 24 * 60 * 60; // 24 heures
    if (now - payload.iat > maxAge) {
      throw new UnauthorizedException('Token trop ancien');
    }

    // Vérifier que le token n'est pas du futur
    if (payload.iat > now + 300) { // 5 minutes de tolérance
      throw new UnauthorizedException('Token du futur détecté');
    }
  }

  private async checkTokenRevocation(tokenId: string): Promise<void> {
    // TODO: Implémenter la vérification de révocation avec Redis ou auth-service
    // Pour l'instant, on skip cette vérification
    if (!tokenId) {
      return;
    }

    // Exemple d'implémentation avec Redis:
    // const isRevoked = await this.redisService.get(`revoked_token:${tokenId}`);
    // if (isRevoked) {
    //   throw new UnauthorizedException('Token révoqué');
    // }
  }

  private logAuthSuccess(request: Request, payload: any): void {
    this.logger.debug('Authentication successful', {
      userId: payload.sub,
      deviceId: payload.device_id,
      path: request.path,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ip: this.getClientIp(request),
    });
  }

  private logAuthFailure(request: Request, error: any): void {
    this.logger.warn('Authentication failed', {
      error: error.message,
      path: request.path,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ip: this.getClientIp(request),
      authHeader: request.headers.authorization ? 'present' : 'missing',
    });
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      'unknown'
    );
  }

  private getErrorMessage(error: any): string {
    if (error instanceof UnauthorizedException) {
      return error.message;
    }
    
    // Messages d'erreur génériques pour éviter les fuites d'information
    switch (error.name) {
      case 'TokenExpiredError':
        return 'Token expiré';
      case 'JsonWebTokenError':
        return 'Token invalide';
      case 'NotBeforeError':
        return 'Token pas encore valide';
      default:
        return 'Authentification échouée';
    }
  }
}