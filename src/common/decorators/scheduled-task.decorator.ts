import { SetMetadata } from '@nestjs/common';

export const SCHEDULED_TASK_METADATA = 'scheduledTask';

export interface ScheduledTaskOptions {
  name: string;
  description?: string;
  category: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  maxRetries?: number;
}

export const ScheduledTask = (options: ScheduledTaskOptions) =>
  SetMetadata(SCHEDULED_TASK_METADATA, options);
