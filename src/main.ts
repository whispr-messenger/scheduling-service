import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './modules/app/app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
	const logger = new Logger('Bootstrap');

	const app = await NestFactory.create(AppModule, {
		logger: ['error', 'warn', 'log', 'debug', 'verbose'],
	});

	const configService = app.get(ConfigService);

	if (configService.get('CORS_ENABLED', 'true') === 'true') {
		app.enableCors({
			origin: configService.get('CORS_ORIGIN', '*'),
			credentials: true,
		});
	}

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

	app.useGlobalFilters(new HttpExceptionFilter());
	app.useGlobalInterceptors(new LoggingInterceptor());

	if (configService.get('SWAGGER_ENABLED', 'true') === 'true') {
		const config = new DocumentBuilder()
			.setTitle('Whispr Scheduling Service API')
			.setDescription('Task scheduling and orchestration service')
			.setVersion('1.0.0')
			.addBearerAuth()
			.addTag('Scheduler', 'Job scheduling and execution')
			.addTag('Monitoring', 'Health checks and metrics')
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('/api/docs', app, document, {
			swaggerOptions: {
				persistAuthorization: true,
			},
		});

		logger.log(`Swagger documentation available at /api/docs`);
	}

	const port = configService.get('PORT', '3000');
	await app.listen(port, '0.0.0.0');

	logger.log(`🚀 Whispr Scheduling Service is running on port ${port}`);
	logger.log(`📊 Health check available at http://localhost:${port}/api/v1/monitoring/health`);
	logger.log(`📈 Metrics available at http://localhost:${port}/api/v1/monitoring/metrics`);

	if (configService.get('SWAGGER_ENABLED', 'true') === 'true') {
		logger.log(`📚 API Documentation available at http://localhost:${port}/api/docs`);
	}

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
