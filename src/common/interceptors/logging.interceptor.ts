import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const correlationId = headers['x-correlation-id'] || 'unknown';

    this.logger.log({
      message: 'Incoming request',
      method,
      url,
      userAgent,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log({
          message: 'Request completed',
          method,
          url,
          duration: `${duration}ms`,
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }
}