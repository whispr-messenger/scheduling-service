import { Injectable } from '@nestjs/common';
import { BaseJobHandler } from './base-job.handler';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
  }>;
}

@Injectable()
export class EmailJobHandler extends BaseJobHandler {
  private transporter: nodemailer.Transporter;

  constructor() {
    super('EmailJobHandler');
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Configure SMTP transporter
    // In production, use environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async execute(payload: EmailPayload): Promise<any> {
    this.logger.log(`Sending email to: ${payload.to}`);

    // Validate required fields
    this.validatePayload(payload, ['to', 'subject']);

    if (!payload.text && !payload.html) {
      throw new Error('Email must have either text or html content');
    }

    try {
      // Send email with retry logic
      const result = await this.retry(
        async () => {
          const info = await this.transporter.sendMail({
            from: payload.from || process.env.SMTP_FROM || '"Whispr" <noreply@whispr.com>',
            to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
            cc: payload.cc
              ? Array.isArray(payload.cc)
                ? payload.cc.join(', ')
                : payload.cc
              : undefined,
            bcc: payload.bcc
              ? Array.isArray(payload.bcc)
                ? payload.bcc.join(', ')
                : payload.bcc
              : undefined,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
            attachments: payload.attachments,
          });

          return info;
        },
        3,
        2000,
      );

      this.logger.log(`Email sent successfully: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error(`SMTP connection failed: ${error.message}`);
      return false;
    }
  }
}
