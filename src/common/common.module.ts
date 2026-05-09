import { Module, Global } from '@nestjs/common';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { TimezoneUtil } from './utils/timezone.util';
import { CronUtil } from './utils/cron.util';
import { RetryUtil } from './utils/retry.util';
import { WebhookHmacService } from './webhook/webhook-hmac.service';
import { WebhookHmacGuard } from './webhook/webhook-hmac.guard';

@Global()
@Module({
	providers: [
		LoggingInterceptor,
		HttpExceptionFilter,
		ValidationPipe,
		TimezoneUtil,
		CronUtil,
		RetryUtil,
		WebhookHmacService,
		WebhookHmacGuard,
	],
	exports: [
		LoggingInterceptor,
		HttpExceptionFilter,
		ValidationPipe,
		TimezoneUtil,
		CronUtil,
		RetryUtil,
		WebhookHmacService,
		WebhookHmacGuard,
	],
})
export class CommonModule {}
