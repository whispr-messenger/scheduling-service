import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { JobData, MessagingJobData, JobResult } from '../../queues/interfaces/job.interface';

@Processor('high-priority')
export class MessagingProcessor {
  private readonly logger = new Logger(MessagingProcessor.name);

  @Process('messaging-service.SendScheduledMessage')
  async sendScheduledMessage(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing scheduled message job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;
      const messageData = payload as MessagingJobData;

      // Validation des données du message
      this.validateMessageData(messageData);

      // Simulation de l'envoi via messaging-service
      // Dans un vrai projet, ceci serait un appel gRPC
      const result = await this.callMessagingService('SendScheduledMessage', messageData, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully sent scheduled message ${messageData.messageId} in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          messageId: messageData.messageId,
          conversationId: messageData.conversationId,
          recipientCount: messageData.recipientIds.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to send scheduled message: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  @Process('messaging-service.CleanupExpiredMessages')
  async cleanupExpiredMessages(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing message cleanup job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;

      // Simulation du nettoyage via messaging-service
      const result = await this.callMessagingService('CleanupExpiredMessages', payload, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully cleaned up expired messages in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          cleanupType: 'expired_messages',
          deletedCount: result?.deletedCount || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup expired messages: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  @Process('messaging-service.BulkMessageDelivery')
  async bulkMessageDelivery(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing bulk message delivery job ${job.id}`);

    try {
      const { payload, correlationId } = job.data;
      const bulkData = payload as { messages: MessagingJobData[], options?: any };

      if (!Array.isArray(bulkData.messages)) {
        throw new Error('Invalid bulk message data: messages must be an array');
      }

      // Valider chaque message
      for (const messageData of bulkData.messages) {
        this.validateMessageData(messageData);
      }

      // Simulation de l'envoi en lot via messaging-service
      const result = await this.callMessagingService('BulkMessageDelivery', payload, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully processed bulk delivery of ${bulkData.messages.length} messages in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
        metadata: {
          messageCount: bulkData.messages.length,
          successCount: result?.successCount || 0,
          failureCount: result?.failureCount || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed bulk message delivery: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  private validateMessageData(messageData: MessagingJobData): void {
    if (!messageData.messageId) {
      throw new Error('Message ID is required');
    }

    if (!messageData.conversationId) {
      throw new Error('Conversation ID is required');
    }

    if (!messageData.senderId) {
      throw new Error('Sender ID is required');
    }

    if (!messageData.recipientIds || messageData.recipientIds.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!messageData.content || messageData.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (!messageData.messageType) {
      throw new Error('Message type is required');
    }

    // Validation du format des IDs (UUID basique)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(messageData.messageId)) {
      throw new Error('Invalid message ID format');
    }

    if (!uuidRegex.test(messageData.conversationId)) {
      throw new Error('Invalid conversation ID format');
    }

    if (!uuidRegex.test(messageData.senderId)) {
      throw new Error('Invalid sender ID format');
    }

    for (const recipientId of messageData.recipientIds) {
      if (!uuidRegex.test(recipientId)) {
        throw new Error(`Invalid recipient ID format: ${recipientId}`);
      }
    }

    // Validation de la longueur du contenu
    if (messageData.content.length > 10000) {
      throw new Error('Message content too long (max 10000 characters)');
    }

    // Validation du type de message
    const allowedTypes = ['text', 'image', 'file', 'voice', 'video', 'system'];
    if (!allowedTypes.includes(messageData.messageType)) {
      throw new Error(`Invalid message type: ${messageData.messageType}`);
    }

    // Validation de la date de livraison programmée
    if (messageData.scheduledDelivery) {
      const scheduledTime = new Date(messageData.scheduledDelivery);
      if (isNaN(scheduledTime.getTime())) {
        throw new Error('Invalid scheduled delivery date');
      }

      if (scheduledTime.getTime() <= Date.now()) {
        throw new Error('Scheduled delivery must be in the future');
      }
    }
  }

  private async callMessagingService(
    method: string,
    data: any,
    correlationId?: string,
  ): Promise<any> {
    // SIMULATION - Dans un vrai projet, ceci serait un appel gRPC au messaging-service
    this.logger.debug(`Calling messaging-service.${method} with correlation ID: ${correlationId}`);

    // Simuler un délai d'exécution
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simuler des réponses selon la méthode
    switch (method) {
      case 'SendScheduledMessage':
        return {
          messageId: data.messageId,
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          recipientCount: data.recipientIds?.length || 0,
        };

      case 'CleanupExpiredMessages':
        return {
          deletedCount: Math.floor(Math.random() * 100) + 1,
          processedAt: new Date().toISOString(),
        };

      case 'BulkMessageDelivery':
        const messageCount = data.messages?.length || 0;
        const successCount = Math.floor(messageCount * 0.95); // 95% de succès
        return {
          messageCount,
          successCount,
          failureCount: messageCount - successCount,
          processedAt: new Date().toISOString(),
        };

      default:
        throw new Error(`Unknown messaging service method: ${method}`);
    }
  }
}