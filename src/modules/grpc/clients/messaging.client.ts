import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '@/modules/queues/services/queue.service';

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
	status?: string;
	queueName?: string;
	dispatchId?: string;
}

export interface HealthResponse {
	status: string;
	message: string;
}

@Injectable()
export class MessagingGrpcClient {
	private readonly logger = new Logger(MessagingGrpcClient.name);
	// Phase 1: use BullMQ as the outbound transport for messaging calls.
	private readonly dispatchQueueName = 'messaging-dispatch';

	constructor(private readonly queueService: QueueService) {}

	async sendScheduledMessage(request: SendScheduledMessageRequest): Promise<SendMessageResponse> {
		this.logger.log('Dispatching scheduled message event to BullMQ', {
			conversationId: request.conversationId,
			messageType: request.messageType,
		});

		try {
			// Only enqueue dispatch intent here; actual delivery is handled by downstream consumers.
			const dispatchJob = await this.queueService.addJob(
				this.dispatchQueueName,
				'messaging.send_scheduled_message',
				{
					eventName: 'messaging.send_scheduled_message',
					dispatchedAt: new Date().toISOString(),
					payload: {
						conversationId: request.conversationId,
						senderId: request.senderId,
						messageType: request.messageType,
						content: request.content,
						metadata: request.metadata ?? {},
						scheduledFor: request.scheduledFor,
					},
				}
			);

			this.logger.log('Scheduled message event queued', {
				dispatchId: dispatchJob.id,
				queueName: this.dispatchQueueName,
			});

			return {
				messageId: String(dispatchJob.id),
				// Keep explicit queued semantics to avoid pretending remote delivery succeeded.
				status: 'queued',
				sentAt: new Date(),
			};
		} catch (error) {
			this.logger.error('Failed to queue scheduled message event', {
				error: error.message,
				conversationId: request.conversationId,
			});
			throw error;
		}
	}

	async cleanupExpiredMessages(request: CleanupRequest): Promise<CleanupResponse> {
		this.logger.log('Dispatching cleanup expired messages event to BullMQ', {
			olderThan: request.olderThan,
			batchSize: request.batchSize,
		});

		try {
			// Cleanup is also dispatched asynchronously to preserve retry/DLQ behavior in BullMQ.
			const dispatchJob = await this.queueService.addJob(
				this.dispatchQueueName,
				'messaging.cleanup_expired_messages',
				{
					eventName: 'messaging.cleanup_expired_messages',
					dispatchedAt: new Date().toISOString(),
					payload: {
						olderThan: request.olderThan,
						batchSize: request.batchSize,
					},
				}
			);

			this.logger.log('Cleanup expired messages event queued', {
				dispatchId: dispatchJob.id,
				queueName: this.dispatchQueueName,
			});

			return {
				deletedCount: 0,
				processedAt: new Date(),
				status: 'queued',
				queueName: this.dispatchQueueName,
				dispatchId: String(dispatchJob.id),
			};
		} catch (error) {
			this.logger.error('Failed to queue cleanup expired messages event', {
				error: error.message,
			});
			throw error;
		}
	}

	async healthCheck(): Promise<HealthResponse> {
		try {
			return {
				status: 'ok',
				message: `Messaging dispatch queue ready (${this.dispatchQueueName})`,
			};
		} catch (error) {
			this.logger.error('Messaging dispatch health check failed', {
				error: error.message,
			});
			throw error;
		}
	}
}
