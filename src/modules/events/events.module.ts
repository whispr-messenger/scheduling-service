import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisPubSubService } from './services/redis-pubsub.service';
import { MessagingEventsService } from './services/messaging-events.service';
import { NotificationEventsService } from './services/notification-events.service';

@Module({
	imports: [ConfigModule],
	providers: [RedisPubSubService, MessagingEventsService, NotificationEventsService],
	exports: [RedisPubSubService, MessagingEventsService, NotificationEventsService],
})
export class EventsModule {}
