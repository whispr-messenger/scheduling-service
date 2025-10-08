import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export class RetryUtil {
  private static readonly logger = new Logger(RetryUtil.name);

  static calculateBackoffDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    multiplier = 2,
  ): number {
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;

    return Math.floor(delay + jitter);
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    context?: string,
  ): Promise<T> {
    let lastError: Error = new Error('Retry failed with no error captured');

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (
          options.retryableErrors &&
          !this.isRetryableError(error as Error, options.retryableErrors)
        ) {
          throw error;
        }

        if (attempt === options.maxAttempts) {
          this.logger.error(`Final attempt ${attempt} failed for ${context || 'operation'}`, error);
          throw error;
        }

        const delay = this.calculateBackoffDelay(
          attempt,
          options.baseDelay,
          options.maxDelay,
          options.backoffMultiplier,
        );

        this.logger.warn(
          `Attempt ${attempt} failed for ${context || 'operation'}, retrying in ${delay}ms`,
          error.message,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private static isRetryableError(error: Error, retryableErrors: string[]): boolean {
    return retryableErrors.some(
      (errorType) => error.name.includes(errorType) || error.message.includes(errorType),
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getDefaultRetryOptions(): RetryOptions {
    return {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'],
    };
  }
}
