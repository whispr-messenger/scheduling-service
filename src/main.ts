import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Security middlewares
  app.use(helmet());
  app.use(compression());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(), new CorrelationInterceptor());

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Scheduling Service API')
    .setDescription('Service de planification et d\'exécution de tâches automatisées pour Whispr')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('jobs', 'Gestion des tâches')
    .addTag('schedules', 'Gestion des planifications')
    .addTag('monitoring', 'Surveillance et métriques')
    .addTag('health', 'Vérification de santé')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  await app.listen(port);
  console.log(`🚀 Scheduling Service is running on port ${port}`);
  console.log(`📚 API Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});