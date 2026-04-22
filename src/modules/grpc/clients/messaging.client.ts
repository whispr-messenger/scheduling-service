import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, TimeoutError, timeout } from 'rxjs';

// Messaging service interface
export interface MessagingServiceClient {
	sendScheduledMessage(data: SendScheduledMessageRequest): Observable<SendMessageResponse>;
	cleanupExpiredMessages(data: CleanupRequest): Observable<CleanupResponse>;
	healthCheck(): Observable<HealthResponse>;
}

const GRPC_CALL_TIMEOUT_MS = 5_000;

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

	constructor(@Inject('MESSAGING_SERVICE') private readonly client: ClientGrpc) {}

	onModuleInit() {
		this.messagingService = this.client.getService<MessagingServiceClient>('MessagingService');
		this.logger.log('Messaging gRPC client initialized');
	}

	private async call<T>(label: string, observable: Observable<T>): Promise<T> {
		try {
			return await firstValueFrom(observable.pipe(timeout(GRPC_CALL_TIMEOUT_MS)));
		} catch (error) {
			if (error instanceof TimeoutError) {
				throw new Error(`Messaging gRPC call "${label}" timed out after ${GRPC_CALL_TIMEOUT_MS}ms`, {
					cause: error,
				});
			}
			throw error;
		}
	}

	async sendScheduledMessage(request: SendScheduledMessageRequest): Promise<SendMessageResponse> {
		this.logger.log('Sending scheduled message via gRPC', {
			conversationId: request.conversationId,
			messageType: request.messageType,
		});

		try {
			const response = await this.call(
				'sendScheduledMessage',
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
			const response = await this.call(
				'cleanupExpiredMessages',
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
			return await this.call('healthCheck', this.messagingService.healthCheck());
		} catch (error) {
			this.logger.error('Messaging service health check failed', {
				error: error.message,
			});
			throw error;
		}
	}
}
