import { Injectable } from '@nestjs/common';
import { BaseJobHandler } from './base-job.handler';
import axios from 'axios';

export interface NotificationPayload {
  type: 'push' | 'sms';
  to: string | string[];
  title?: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

@Injectable()
export class NotificationJobHandler extends BaseJobHandler {
  constructor() {
    super('NotificationJobHandler');
  }

  async execute(payload: NotificationPayload): Promise<any> {
    this.logger.log(`Sending ${payload.type} notification to: ${payload.to}`);

    // Validate required fields
    this.validatePayload(payload, ['type', 'to', 'body']);

    if (payload.type === 'push') {
      return this.sendPushNotification(payload);
    } else if (payload.type === 'sms') {
      return this.sendSMS(payload);
    } else {
      throw new Error(`Unknown notification type: ${payload.type}`);
    }
  }

  private async sendPushNotification(payload: NotificationPayload): Promise<any> {
    this.logger.log('Sending push notification via FCM');

    const fcmServerKey = process.env.FCM_SERVER_KEY;
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';

    if (!fcmServerKey) {
      throw new Error('FCM_SERVER_KEY not configured');
    }

    try {
      const tokens = Array.isArray(payload.to) ? payload.to : [payload.to];

      const result = await this.retry(
        async () => {
          const response = await axios.post(
            fcmUrl,
            {
              registration_ids: tokens,
              notification: {
                title: payload.title || 'Notification',
                body: payload.body,
                sound: payload.sound || 'default',
                badge: payload.badge,
              },
              data: payload.data || {},
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `key=${fcmServerKey}`,
              },
            },
          );

          return response.data;
        },
        3,
        2000,
      );

      this.logger.log(`Push notification sent: ${result.success} success, ${result.failure} failures`);

      return {
        success: true,
        sent: result.success,
        failed: result.failure,
        results: result.results,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      throw error;
    }
  }

  private async sendSMS(payload: NotificationPayload): Promise<any> {
    this.logger.log('Sending SMS via Twilio');

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      const phones = Array.isArray(payload.to) ? payload.to : [payload.to];

      const results = await Promise.all(
        phones.map((phone) =>
          this.retry(
            async () => {
              const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
                new URLSearchParams({
                  To: phone,
                  From: twilioPhoneNumber,
                  Body: payload.body,
                }),
                {
                  auth: {
                    username: twilioAccountSid,
                    password: twilioAuthToken,
                  },
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                },
              );

              return response.data;
            },
            3,
            2000,
          ),
        ),
      );

      this.logger.log(`SMS sent to ${results.length} recipients`);

      return {
        success: true,
        sent: results.length,
        results,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      throw error;
    }
  }
}
