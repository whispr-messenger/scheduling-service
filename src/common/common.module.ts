import { Module, Global } from '@nestjs/common';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { TimezoneUtil } from './utils/timezone.util';
import { CronUtil } from './utils/cron.util';
import { RetryUtil } from './utils/retry.util';

@Global()
@Module({
  providers: [
    LoggingInterceptor,
    HttpExceptionFilter,
    ValidationPipe,
    TimezoneUtil,
    CronUtil,
    RetryUtil,
  ],
  exports: [
    LoggingInterceptor,
    HttpExceptionFilter,
    ValidationPipe,
    TimezoneUtil,
    CronUtil,
    RetryUtil,
  ],
})
export class CommonModule {}
