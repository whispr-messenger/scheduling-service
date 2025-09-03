import { Module } from '@nestjs/common';
import { MessagingProcessor } from './processors/messaging.processor';
import { NotificationProcessor } from './processors/notification.processor';

@Module({
  providers: [
    MessagingProcessor,
    NotificationProcessor,
  ],
  exports: [MessagingProcessor, NotificationProcessor],
})
export class TasksModule {}