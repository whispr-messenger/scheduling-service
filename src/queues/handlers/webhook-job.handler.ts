import { Injectable } from '@nestjs/common';
import { BaseJobHandler } from './base-job.handler';
import axios, { AxiosRequestConfig } from 'axios';

export interface WebhookPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
  };
}

@Injectable()
export class WebhookJobHandler extends BaseJobHandler {
  constructor() {
    super('WebhookJobHandler');
  }

  async execute(payload: WebhookPayload): Promise<any> {
    this.logger.log(`Calling webhook: ${payload.method || 'POST'} ${payload.url}`);

    // Validate required fields
    this.validatePayload(payload, ['url']);

    const method = payload.method || 'POST';
    const timeout = payload.timeout || 30000; // 30 seconds default
    const maxRetries = payload.retry?.maxAttempts || 3;
    const retryDelay = payload.retry?.delayMs || 2000;

    try {
      const result = await this.retry(
        async () => {
          const config: AxiosRequestConfig = {
            method,
            url: payload.url,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Whispr-Scheduler/1.0',
              ...payload.headers,
            },
            timeout,
          };

          if (payload.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            config.data = payload.body;
          }

          const startTime = Date.now();
          const response = await axios(config);
          const duration = Date.now() - startTime;

          this.logger.log(
            `Webhook call successful: ${response.status} in ${duration}ms`,
          );

          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            duration,
          };
        },
        maxRetries,
        retryDelay,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Webhook call failed after ${maxRetries} attempts: ${error.message}`,
      );

      // Return detailed error info
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Webhook failed: ${error.response?.status || 'unknown'} - ${
            error.response?.statusText || error.message
          }`,
        );
      }

      throw error;
    }
  }

  async testWebhook(url: string): Promise<boolean> {
    try {
      await axios.get(url, { timeout: 5000 });
      return true;
    } catch (error) {
      this.logger.warn(`Webhook test failed for ${url}: ${error.message}`);
      return false;
    }
  }
}
