import { BadRequestException } from '@nestjs/common';

export class CronUtil {
  private static readonly CRON_REGEX =
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

  static validateCronExpression(cronExpression: string): void {
    if (!cronExpression) {
      throw new BadRequestException('Cron expression is required');
    }

    if (!this.CRON_REGEX.test(cronExpression)) {
      throw new BadRequestException('Invalid cron expression format');
    }
  }

  static getNextExecutionTime(cronExpression: string): Date {
    this.validateCronExpression(cronExpression);

    // Basic implementation - use node-cron or cron-parser in production
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Next minute for simplicity

    return nextRun;
  }

  static isValidCronExpression(cronExpression: string): boolean {
    try {
      this.validateCronExpression(cronExpression);
      return true;
    } catch {
      return false;
    }
  }

  static describeCronExpression(cronExpression: string): string {
    this.validateCronExpression(cronExpression);

    // Basic descriptions - use cronstrue library in production
    const descriptions: Record<string, string> = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 9 * * 1': 'Weekly on Monday at 9:00 AM',
      '*/30 * * * *': 'Every 30 minutes',
      '0 */2 * * *': 'Every 2 hours',
      '0 0 1 * *': 'Monthly on the 1st at midnight',
    };

    return descriptions[cronExpression] || 'Custom schedule';
  }

  static getCommonCronExpressions(): Record<string, string> {
    return {
      '@yearly': '0 0 1 1 *',
      '@annually': '0 0 1 1 *',
      '@monthly': '0 0 1 * *',
      '@weekly': '0 0 * * 0',
      '@daily': '0 0 * * *',
      '@midnight': '0 0 * * *',
      '@hourly': '0 * * * *',
    };
  }
}
