import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisPubSubService } from './redis-pubsub.service';

export interface NotificationDispatchRequest {
	method: string;
	payload: Record<string, any>;
}

export interface NotificationDispatchResponse {
	dispatchId: string;
	channel: string;
	status: string;
	dispatchedAt: Date;
}

@Injectable()
export class NotificationEventsService {
	private readonly logger = new Logger(NotificationEventsService.name);
	private readonly channel: string;

	constructor(
		private readonly pubsub: RedisPubSubService,
		private readonly configService: ConfigService
	) {
		this.channel = this.configService.get<string>(
			'NOTIFICATION_EVENTS_CHANNEL',
			'whispr.notification.events'
		);
	}

	async dispatch(request: NotificationDispatchRequest): Promise<NotificationDispatchResponse> {
		const dispatchId = randomUUID();
		const event = {
			eventName: `notification.${request.method}`,
			dispatchId,
			dispatchedAt: new Date().toISOString(),
			payload: request.payload,
		};

		const receivers = await this.pubsub.publish(this.channel, event);
		this.logger.log('Notification event published', {
			channel: this.channel,
			dispatchId,
			receivers,
		});

		return {
			dispatchId,
			channel: this.channel,
			status: 'published',
			dispatchedAt: new Date(),
		};
	}
}
