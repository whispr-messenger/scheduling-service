import { Priority } from '../../../common/enums';

export interface JobData {
  id: string;
  name: string;
  categoryId: string;
  targetService: string;
  targetMethod: string;
  payload: Record<string, any>;
  priority: Priority;
  maxRetries: number;
  timeoutSeconds: number;
  correlationId?: string;
  createdBy?: string;
  executionId: string;
}

export interface ScheduledJobData extends JobData {
  scheduleId?: string;
  scheduledAt?: Date;
  timezone: string;
}

export interface MessagingJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientIds: string[];
  content: string;
  messageType: string;
  scheduledDelivery?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationJobData {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledFor?: Date;
  channels: string[];
  data?: Record<string, any>;
}

export interface MaintenanceJobData {
  taskType: 'vacuum' | 'reindex' | 'cleanup' | 'backup' | 'optimization';
  targetDatabase?: string;
  targetTable?: string;
  parameters?: Record<string, any>;
  maintenanceWindow?: {
    startTime: string;
    endTime: string;
  };
}

export interface CleanupJobData {
  cleanupType: 'files' | 'cache' | 'logs' | 'sessions' | 'data';
  targetPath?: string;
  olderThan: Date;
  pattern?: string;
  batchSize?: number;
  dryRun?: boolean;
}

export interface AnalyticsJobData {
  reportType: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  filters?: Record<string, any>;
  outputFormat: 'json' | 'csv' | 'pdf';
  recipients?: string[];
  parameters?: Record<string, any>;
}

export enum QueuePriority {
  HIGH = 'high-priority',
  MEDIUM = 'medium-priority',
  LOW = 'low-priority',
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}