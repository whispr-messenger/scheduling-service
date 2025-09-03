import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { JobData, NotificationJobData, JobResult } from '../../queues/interfaces/job.interface';

@Processor('high-priority')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process('notification-service.SendDelayedNotification')
  async sendDelayedNotification(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing delayed notification job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;
      const notificationData = payload as NotificationJobData;

      // Validation des données de notification
      this.validateNotificationData(notificationData);

      // Simulation de l'envoi via notification-service
      const result = await this.callNotificationService('SendDelayedNotification', notificationData, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully sent delayed notification ${notificationData.notificationId} in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          notificationId: notificationData.notificationId,
          userId: notificationData.userId,
          type: notificationData.type,
          channelCount: notificationData.channels.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to send delayed notification: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  @Process('notification-service.CleanupNotificationHistory')
  async cleanupNotificationHistory(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing notification history cleanup job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;

      // Simulation du nettoyage via notification-service
      const result = await this.callNotificationService('CleanupNotificationHistory', payload, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully cleaned up notification history in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          cleanupType: 'notification_history',
          deletedCount: result?.deletedCount || 0,
          olderThanDays: payload?.olderThanDays || 30,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup notification history: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  @Process('notification-service.SendBulkNotifications')
  async sendBulkNotifications(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing bulk notifications job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;
      const bulkData = payload as { notifications: NotificationJobData[], options?: any };

      if (!Array.isArray(bulkData.notifications)) {
        throw new Error('Invalid bulk notification data: notifications must be an array');
      }

      // Valider chaque notification
      for (const notificationData of bulkData.notifications) {
        this.validateNotificationData(notificationData);
      }

      // Simulation de l'envoi en lot via notification-service
      const result = await this.callNotificationService('SendBulkNotifications', payload, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully processed bulk delivery of ${bulkData.notifications.length} notifications in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          notificationCount: bulkData.notifications.length,
          successCount: result?.successCount || 0,
          failureCount: result?.failureCount || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed bulk notification delivery: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  @Process('notification-service.ProcessScheduledReminders')
  async processScheduledReminders(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing scheduled reminders job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;

      // Simulation du traitement des rappels via notification-service
      const result = await this.callNotificationService('ProcessScheduledReminders', payload, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully processed scheduled reminders in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          processedCount: result?.processedCount || 0,
          sentCount: result?.sentCount || 0,
          skippedCount: result?.skippedCount || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to process scheduled reminders: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  private validateNotificationData(notificationData: NotificationJobData): void {
    if (!notificationData.notificationId) {
      throw new Error('Notification ID is required');
    }

    if (!notificationData.userId) {
      throw new Error('User ID is required');
    }

    if (!notificationData.title || notificationData.title.trim().length === 0) {
      throw new Error('Notification title cannot be empty');
    }

    if (!notificationData.message || notificationData.message.trim().length === 0) {
      throw new Error('Notification message cannot be empty');
    }

    if (!notificationData.type) {
      throw new Error('Notification type is required');
    }

    if (!notificationData.priority) {
      throw new Error('Notification priority is required');
    }

    if (!notificationData.channels || notificationData.channels.length === 0) {
      throw new Error('At least one notification channel is required');
    }

    // Validation du format des IDs (UUID basique)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(notificationData.notificationId)) {
      throw new Error('Invalid notification ID format');
    }

    if (!uuidRegex.test(notificationData.userId)) {
      throw new Error('Invalid user ID format');
    }

    // Validation des longueurs de texte
    if (notificationData.title.length > 100) {
      throw new Error('Notification title too long (max 100 characters)');
    }

    if (notificationData.message.length > 1000) {
      throw new Error('Notification message too long (max 1000 characters)');
    }

    // Validation du type de notification
    const allowedTypes = [
      'message', 'friend_request', 'system', 'security', 'reminder', 
      'update', 'promotion', 'event', 'achievement', 'warning'
    ];
    if (!allowedTypes.includes(notificationData.type)) {
      throw new Error(`Invalid notification type: ${notificationData.type}`);
    }

    // Validation de la priorité
    const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!allowedPriorities.includes(notificationData.priority)) {
      throw new Error(`Invalid notification priority: ${notificationData.priority}`);
    }

    // Validation des canaux
    const allowedChannels = ['push', 'email', 'sms', 'in_app', 'webhook'];
    for (const channel of notificationData.channels) {
      if (!allowedChannels.includes(channel)) {
        throw new Error(`Invalid notification channel: ${channel}`);
      }
    }

    // Validation de la date de programmation
    if (notificationData.scheduledFor) {
      const scheduledTime = new Date(notificationData.scheduledFor);
      if (isNaN(scheduledTime.getTime())) {
        throw new Error('Invalid scheduled date');
      }

      if (scheduledTime.getTime() <= Date.now()) {
        throw new Error('Scheduled date must be in the future');
      }
    }
  }

  private async callNotificationService(
    method: string,
    data: any,
    correlationId?: string,
  ): Promise<any> {
    // SIMULATION - Dans un vrai projet, ceci serait un appel gRPC au notification-service
    this.logger.debug(`Calling notification-service.${method} with correlation ID: ${correlationId}`);

    // Simuler un délai d'exécution
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

    // Simuler des réponses selon la méthode
    switch (method) {
      case 'SendDelayedNotification':
        return {
          notificationId: data.notificationId,
          status: 'sent',
          sentAt: new Date().toISOString(),
          channels: data.channels || [],
          deliveryResults: data.channels?.map((channel: string) => ({
            channel,
            status: Math.random() > 0.1 ? 'delivered' : 'failed', // 90% de succès
            timestamp: new Date().toISOString(),
          })),
        };

      case 'CleanupNotificationHistory':
        return {
          deletedCount: Math.floor(Math.random() * 1000) + 100,
          processedAt: new Date().toISOString(),
          olderThanDays: data?.olderThanDays || 30,
        };

      case 'SendBulkNotifications':
        const notificationCount = data.notifications?.length || 0;
        const successRate = 0.92; // 92% de succès
        const successCount = Math.floor(notificationCount * successRate);
        return {
          notificationCount,
          successCount,
          failureCount: notificationCount - successCount,
          processedAt: new Date().toISOString(),
        };

      case 'ProcessScheduledReminders':
        const processedCount = Math.floor(Math.random() * 50) + 10;
        const sentCount = Math.floor(processedCount * 0.8); // 80% envoyés
        return {
          processedCount,
          sentCount,
          skippedCount: processedCount - sentCount,
          processedAt: new Date().toISOString(),
        };

      default:
        throw new Error(`Unknown notification service method: ${method}`);
    }
  }
}