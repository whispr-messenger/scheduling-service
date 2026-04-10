import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './modules/app/app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ReflectionService } from '@grpc/reflection';

async function bootstrap() {
	const logger = new Logger('Bootstrap');

	// Create HTTP application
	const app = await NestFactory.create(AppModule, {
		logger: ['error', 'warn', 'log', 'debug', 'verbose'],
	});

	const configService = app.get(ConfigService);

	// Enable CORS if configured
	if (configService.get('CORS_ENABLED', 'true') === 'true') {
		app.enableCors({
			origin: configService.get('CORS_ORIGIN', '*'),
			credentials: true,
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
		})
	);

	// Global exception filter
	app.useGlobalFilters(new HttpExceptionFilter());

	// Global logging interceptor
	app.useGlobalInterceptors(new LoggingInterceptor());

	// Swagger configuration
	if (configService.get('SWAGGER_ENABLED', 'true') === 'true') {
		const config = new DocumentBuilder()
			.setTitle('Whispr Scheduling Service API')
			.setDescription('Task scheduling and orchestration service')
			.setVersion('1.0.0')
			.addBearerAuth()
			.addServer('/', 'Current host')
			.addTag('Scheduler', 'Job scheduling and execution')
			.addTag('Monitoring', 'Health checks and metrics')
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('swagger', app, document, {
			swaggerOptions: {
				persistAuthorization: true,
			},
		});

		logger.log(`Swagger documentation available at /swagger`);
	}

	// Resolve .proto path for both dev (src) and prod (dist)
	const srcProtoPath = join(process.cwd(), 'src/modules/grpc/proto/scheduler.proto');
	const distProtoPath = join(__dirname, 'modules/grpc/proto/scheduler.proto');
	const protoPath = existsSync(distProtoPath) ? distProtoPath : srcProtoPath;

	// gRPC microservice configuration
	const grpcHost = configService.get('GRPC_HOST', '0.0.0.0');
	const grpcPort = configService.get('GRPC_PORT', '3001');
	const grpcUrl = `${grpcHost}:${grpcPort}`;
	app.connectMicroservice<MicroserviceOptions>({
		transport: Transport.GRPC,
		options: {
			package: 'whispr.scheduler',
			protoPath,
			url: grpcUrl,
			loader: {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
			onLoadPackageDefinition: (pkg, server) => {
				new ReflectionService(pkg).addToServer(server);
			},
		},
	});

	// Enable shutdown hooks so NestJS lifecycle events (onModuleDestroy) fire on app.close()
	app.enableShutdownHooks();

	// Start microservices
	await app.startAllMicroservices();
	logger.log(`gRPC server is listening on ${grpcUrl}`);

	// Start HTTP server
	const port = configService.get('HTTP_PORT', '3000');
	await app.listen(port, '0.0.0.0');

	logger.log(`🚀 Whispr Scheduling Service is running on port ${port}`);
	logger.log(`📊 Health check available at http://localhost:${port}/health`);
	logger.log(`📈 Metrics available at http://localhost:${port}/api/monitoring/metrics`);

	if (configService.get('SWAGGER_ENABLED', 'true') === 'true') {
		logger.log(`📚 API Documentation available at http://localhost:${port}/swagger`);
	}

	// Graceful shutdown logging (enableShutdownHooks handles SIGTERM/SIGINT → app.close())
	process.on('SIGTERM', () => {
		logger.log('SIGTERM received, shutting down gracefully...');
	});

	process.on('SIGINT', () => {
		logger.log('SIGINT received, shutting down gracefully...');
	});
}

bootstrap().catch((error) => {
	const logger = new Logger('Bootstrap');
	logger.error('Failed to start application', error);
	process.exit(1);
});
