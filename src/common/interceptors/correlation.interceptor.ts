import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Générer ou récupérer l'ID de corrélation
    const correlationId = request.headers['x-correlation-id'] as string || uuidv4();
    
    // Ajouter l'ID de corrélation aux headers de la requête et de la réponse
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    
    // Stocker l'ID de corrélation dans le contexte pour utilisation ultérieure
    (request as any).correlationId = correlationId;
    
    return next.handle();
  }
}