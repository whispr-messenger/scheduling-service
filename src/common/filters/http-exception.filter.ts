import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const correlationId = (request as any).correlationId || 'unknown';
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Log de l'erreur avec contexte
    this.logger.error({
      message: 'HTTP Exception',
      status,
      error,
      path,
      method: request.method,
      correlationId,
      timestamp,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Réponse d'erreur sécurisée (pas de stack trace en production)
    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error,
      timestamp,
      path,
      correlationId,
    };

    response.status(status).json(errorResponse);
  }
}