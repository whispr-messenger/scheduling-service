import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create HTTP application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Enable CORS
  if (configService.get('app.cors.enabled')) {
    app.enableCors({
      origin: configService.get('app.cors.origin'),
      credentials: configService.get('app.cors.credentials'),
    });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger configuration
  if (configService.get('app.swagger.enabled')) {
    const config = new DocumentBuilder()
      .setTitle(configService.get('app.swagger.title') || 'API')
      .setDescription(configService.get('app.swagger.description') || 'API Description')
      .setVersion(configService.get('app.swagger.version') || '1.0.0')
      .addBearerAuth()
      .addTag('Scheduler', 'Job scheduling and execution')
      .addTag('Monitoring', 'Health checks and metrics')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(configService.get('app.swagger.path') || '/api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`Swagger documentation available at ${configService.get('app.swagger.path')}`);
  }

  // gRPC microservice
  const grpcUrl = `${configService.get('app.grpc.host')}:${configService.get('app.grpc.port')}`;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'whispr.scheduler',
      protoPath: join(__dirname, 'modules/grpc/proto/scheduler.proto'),
      url: grpcUrl,
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  // Start microservices
  await app.startAllMicroservices();
  logger.log(`gRPC server is listening on ${grpcUrl}`);

  // Start HTTP server
  const port = configService.get('app.port');
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Whispr Scheduling Service is running on port ${port}`);
  logger.log(`📊 Health check available at http://localhost:${port}/api/v1/monitoring/health`);
  logger.log(`📈 Metrics available at http://localhost:${port}/api/v1/monitoring/metrics`);

  if (configService.get('app.swagger.enabled')) {
    logger.log(
      `📚 API Documentation available at http://localhost:${port}${configService.get(
        'app.swagger.path',
      )}`,
    );
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
