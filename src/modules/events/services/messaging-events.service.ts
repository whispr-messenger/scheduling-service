import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisPubSubService } from './redis-pubsub.service';

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
	channel?: string;
	dispatchId?: string;
}

export interface HealthResponse {
	status: string;
	message: string;
}

@Injectable()
export class MessagingEventsService {
	private readonly logger = new Logger(MessagingEventsService.name);
	private readonly channel: string;

	constructor(
		private readonly pubsub: RedisPubSubService,
		private readonly configService: ConfigService
	) {
		this.channel = this.configService.get<string>('MESSAGING_EVENTS_CHANNEL', 'whispr.messaging.events');
	}

	async sendScheduledMessage(request: SendScheduledMessageRequest): Promise<SendMessageResponse> {
		const dispatchId = randomUUID();
		const event = {
			eventName: 'messaging.send_scheduled_message',
			dispatchId,
			dispatchedAt: new Date().toISOString(),
			payload: {
				conversationId: request.conversationId,
				senderId: request.senderId,
				messageType: request.messageType,
				content: request.content,
				metadata: request.metadata ?? {},
				scheduledFor: request.scheduledFor,
			},
		};

		try {
			const receivers = await this.pubsub.publish(this.channel, event);
			this.logger.log('Scheduled message event published', {
				channel: this.channel,
				dispatchId,
				receivers,
			});
			return {
				messageId: dispatchId,
				status: 'published',
				sentAt: new Date(),
			};
		} catch (error) {
			this.logger.error('Failed to publish scheduled message event', {
				error: error.message,
				conversationId: request.conversationId,
			});
			throw error;
		}
	}

	async cleanupExpiredMessages(request: CleanupRequest): Promise<CleanupResponse> {
		const dispatchId = randomUUID();
		const event = {
			eventName: 'messaging.cleanup_expired_messages',
			dispatchId,
			dispatchedAt: new Date().toISOString(),
			payload: {
				olderThan: request.olderThan,
				batchSize: request.batchSize,
			},
		};

		try {
			const receivers = await this.pubsub.publish(this.channel, event);
			this.logger.log('Cleanup expired messages event published', {
				channel: this.channel,
				dispatchId,
				receivers,
			});
			return {
				deletedCount: 0,
				processedAt: new Date(),
				status: 'published',
				channel: this.channel,
				dispatchId,
			};
		} catch (error) {
			this.logger.error('Failed to publish cleanup expired messages event', {
				error: error.message,
			});
			throw error;
		}
	}

	async healthCheck(): Promise<HealthResponse> {
		return {
			status: 'ok',
			message: `Messaging events channel ready (${this.channel})`,
		};
	}
}
