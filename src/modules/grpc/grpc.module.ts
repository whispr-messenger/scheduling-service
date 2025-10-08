import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcSchedulerService } from './services/grpc-scheduler.service';
import { MessagingGrpcClient } from './clients/messaging.client';
import { NotificationGrpcClient } from './clients/notification.client';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { MonitoringModule } from '@/modules/monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'MESSAGING_SERVICE',
        imports: [ConfigModule],
        useFactory: async () => ({
          transport: Transport.GRPC,
          options: {
            package: 'whispr.messaging',
            protoPath: join(__dirname, 'proto/messaging.proto'),
            url: 'messaging-service:50052',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
      },
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        useFactory: async () => ({
          transport: Transport.GRPC,
          options: {
            package: 'whispr.notification',
            protoPath: join(__dirname, 'proto/notification.proto'),
            url: 'notification-service:50053',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
      },
      {
        name: 'MEDIA_SERVICE',
        imports: [ConfigModule],
        useFactory: async () => ({
          transport: Transport.GRPC,
          options: {
            package: 'whispr.media',
            protoPath: join(__dirname, 'proto/media.proto'),
            url: 'media-service:50054',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
      },
      {
        name: 'USER_SERVICE',
        imports: [ConfigModule],
        useFactory: async () => ({
          transport: Transport.GRPC,
          options: {
            package: 'whispr.user',
            protoPath: join(__dirname, 'proto/user.proto'),
            url: 'user-service:50055',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
      },
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        useFactory: async () => ({
          transport: Transport.GRPC,
          options: {
            package: 'whispr.auth',
            protoPath: join(__dirname, 'proto/auth.proto'),
            url: 'auth-service:50056',
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
      },
    ]),
    SchedulerModule,
    MonitoringModule,
  ],
  providers: [GrpcSchedulerService, MessagingGrpcClient, NotificationGrpcClient],
  exports: [GrpcSchedulerService, MessagingGrpcClient, NotificationGrpcClient],
})
export class GrpcModule {}
