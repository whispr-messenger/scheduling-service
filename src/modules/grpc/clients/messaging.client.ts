import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc, Client, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { firstValueFrom, Observable } from 'rxjs';

// Messaging service interface
export interface MessagingServiceClient {
  sendScheduledMessage(data: SendScheduledMessageRequest): Observable<SendMessageResponse>;
  cleanupExpiredMessages(data: CleanupRequest): Observable<CleanupResponse>;
  healthCheck(): Observable<HealthResponse>;
}

export interface SendScheduledMessageRequest {
  conversationId: string;
  senderId: string;
  messageType: string;
  content: string;
  metadata: Record<string, any>;
  scheduledFor: Date;
}

export interface SendMessageResponse {
  messageId: string;
  status: string;
  sentAt: Date;
}

export interface CleanupRequest {
  olderThan: Date;
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
export class MessagingGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(MessagingGrpcClient.name);
  private messagingService: MessagingServiceClient;

  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'whispr.messaging',
      protoPath: join(__dirname, '../proto/messaging.proto'),
      url: 'messaging-service:50052', // Kubernetes service name
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
    this.messagingService = this.client.getService<MessagingServiceClient>('MessagingService');
    this.logger.log('Messaging gRPC client initialized');
  }

  async sendScheduledMessage(request: SendScheduledMessageRequest): Promise<SendMessageResponse> {
    this.logger.log('Sending scheduled message via gRPC', {
      conversationId: request.conversationId,
      messageType: request.messageType,
    });

    try {
      const response = await firstValueFrom(
        this.messagingService.sendScheduledMessage(request)
      );

      this.logger.log('Scheduled message sent successfully', {
        messageId: response.messageId,
        status: response.status,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to send scheduled message', {
        error: error.message,
        conversationId: request.conversationId,
      });
      throw error;
    }
  }

  async cleanupExpiredMessages(request: CleanupRequest): Promise<CleanupResponse> {
    this.logger.log('Cleaning up expired messages via gRPC', {
      olderThan: request.olderThan,
      batchSize: request.batchSize,
    });

    try {
      const response = await firstValueFrom(
        this.messagingService.cleanupExpiredMessages(request)
      );

      this.logger.log('Message cleanup completed', {
        deletedCount: response.deletedCount,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to cleanup expired messages', {
        error: error.message,
      });
      throw error;
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await firstValueFrom(
        this.messagingService.healthCheck()
      );

      return response;
    } catch (error) {
      this.logger.error('Messaging service health check failed', {
        error: error.message,
      });
      throw error;
    }
  }
}