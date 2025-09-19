import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';

// Configuration
import DatabaseConfig from './config/database.config';
import RedisConfig from './config/redis.config';
import SchedulerConfig from './config/scheduler.config';
import AppConfig from './config/app.config';

// Modules
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { QueuesModule } from './modules/queues/queues.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { GrpcModule } from './modules/grpc/grpc.module';
import { CommonModule } from './modules/common/common.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      load: [AppConfig, DatabaseConfig, RedisConfig, SchedulerConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Planification NestJS
    ScheduleModule.forRoot(),

    // Bull Queue avec Redis (désactivé temporairement pour développement)
    // BullModule.forRootAsync({
    //   useFactory: async (configService: ConfigService) => {
    //     const redisConfig = configService.get('redis');
    //     return {
    //       redis: {
    //         host: redisConfig.host,
    //         port: redisConfig.port,
    //         password: redisConfig.password,
    //         db: redisConfig.db,
    //         retryDelayOnFailover: 100,
    //         lazyConnect: true,
    //       },
    //       defaultJobOptions: {
    //         removeOnComplete: 100,
    //         removeOnFail: 50,
    //         attempts: 3,
    //         backoff: {
    //           type: 'exponential',
    //           delay: 2000,
    //         },
    //       },
    //     };
    //   },
    //   inject: [ConfigService],
    // }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 1000,
      },
    ]),

    // Health checks
    TerminusModule,

    // Modules principaux
    CommonModule,
    SchedulerModule,
    TasksModule,
    // QueuesModule, // Désactivé temporairement (nécessite Redis)
    // MonitoringModule, // Désactivé temporairement (nécessite Redis)
    GrpcModule,
  ],
})
export class AppModule {}