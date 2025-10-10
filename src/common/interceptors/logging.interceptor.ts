import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const correlationId = uuidv4();
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const contextType = context.getType();

    let requestInfo: any = {};

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      requestInfo = {
        method: request.method,
        url: request.url,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
      };
    } else if (contextType === 'rpc') {
      const rpcContext = context.switchToRpc();
      requestInfo = {
        pattern: rpcContext.getContext(),
        data: rpcContext.getData(),
      };
    }

    const startTime = Date.now();

    this.logger.log({
      message: 'Request started',
      correlationId,
      className,
      handlerName,
      contextType,
      ...requestInfo,
    });

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        this.logger.log({
          message: 'Request completed successfully',
          correlationId,
          className,
          handlerName,
          duration,
          responseSize: JSON.stringify(response || {}).length,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error({
          message: 'Request failed',
          correlationId,
          className,
          handlerName,
          duration,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }),
    );
  }
}
