import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc, Client, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';

// Notification service interface
export interface NotificationServiceClient {
  sendDelayedNotification(data: SendDelayedNotificationRequest): Promise<NotificationResponse>;
  cleanupNotificationHistory(data: CleanupRequest): Promise<CleanupResponse>;
  healthCheck(): Promise<HealthResponse>;
}

export interface SendDelayedNotificationRequest {
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  scheduledFor: Date;
  channels: string[]; // push, email, sms
}

export interface NotificationResponse {
  notificationId: string;
  status: string;
  sentAt: Date;
  failureReason?: string;
}

export interface CleanupRequest {
  olderThan: Date;
  status?: string;
  batchSize?: number;
}

export interface CleanupResponse {
  deletedCount: number;
  processedAt: Date;
}

export interface HealthResponse {
  status: string;
  message: string;
}

@Injectable()
export class NotificationGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(NotificationGrpcClient.name);
  private notificationService: NotificationServiceClient;

  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'whispr.notification',
      protoPath: join(__dirname, '../proto/notification.proto'),
      url: 'notification-service:50053', // Kubernetes service name
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  })
  private client: ClientGrpc;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.notificationService = this.client.getService<NotificationServiceClient>('NotificationService');
    this.logger.log('Notification gRPC client initialized');
  }

  async sendDelayedNotification(request: SendDelayedNotificationRequest): Promise<NotificationResponse> {
    this.logger.log('Sending delayed notification via gRPC', {
      userId: request.userId,
      type: request.type,
      scheduledFor: request.scheduledFor,
    });

    try {
      const response = await firstValueFrom(
        this.notificationService.sendDelayedNotification(request)
      );

      this.logger.log('Delayed notification sent successfully', {
        notificationId: response.notificationId,
        status: response.status,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to send delayed notification', {
        error: error.message,
        userId: request.userId,
        type: request.type,
      });
      throw error;
    }
  }

  async cleanupNotificationHistory(request: CleanupRequest): Promise<CleanupResponse> {
    this.logger.log('Cleaning up notification history via gRPC', {
      olderThan: request.olderThan,
      status: request.status,
      batchSize: request.batchSize,
    });

    try {
      const response = await firstValueFrom(
        this.notificationService.cleanupNotificationHistory(request)
      );

      this.logger.log('Notification history cleanup completed', {
        deletedCount: response.deletedCount,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to cleanup notification history', {
        error: error.message,
      });
      throw error;
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await firstValueFrom(
        this.notificationService.healthCheck()
      );

      return response;
    } catch (error) {
      this.logger.error('Notification service health check failed', {
        error: error.message,
      });
      throw error;
    }
  }
}