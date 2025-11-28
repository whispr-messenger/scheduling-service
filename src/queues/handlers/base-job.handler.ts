import { Logger } from '@nestjs/common';

export interface JobHandler {
  execute(payload: Record<string, any>): Promise<any>;
}

export abstract class BaseJobHandler implements JobHandler {
  protected readonly logger: Logger;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  abstract execute(payload: Record<string, any>): Promise<any>;

  protected validatePayload(
    payload: Record<string, any>,
    requiredFields: string[],
  ): void {
    const missingFields = requiredFields.filter((field) => !(field in payload));

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields: ${missingFields.join(', ')}`,
      );
    }
  }

  protected async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error = new Error('No attempts made');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Retry attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );

        if (attempt < maxRetries) {
          await this.delay(delayMs * attempt);
        }
      }
    }

    throw lastError;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
