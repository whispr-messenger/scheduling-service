import { BadRequestException } from '@nestjs/common';

export class TimezoneUtil {
  private static readonly VALID_TIMEZONES = [
    'UTC',
    'Europe/Paris',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    // Add more as needed
  ];

  static validateTimezone(timezone: string): void {
    if (!this.VALID_TIMEZONES.includes(timezone)) {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  static convertToTimezone(date: Date, timezone: string): Date {
    this.validateTimezone(timezone);

    if (timezone === 'UTC') {
      return date;
    }

    // Basic timezone conversion - in production, use a proper library like moment-timezone
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const targetTime = new Date(utcTime);

    return targetTime;
  }

  static getTimezoneOffset(timezone: string): number {
    this.validateTimezone(timezone);

    // Basic implementation - use proper timezone library in production
    const timezoneOffsets: Record<string, number> = {
      UTC: 0,
      'Europe/Paris': 1,
      'America/New_York': -5,
      'America/Los_Angeles': -8,
      'Asia/Tokyo': 9,
      'Asia/Shanghai': 8,
      'Australia/Sydney': 11,
    };

    return timezoneOffsets[timezone] || 0;
  }

  static isValidTimezone(timezone: string): boolean {
    return this.VALID_TIMEZONES.includes(timezone);
  }
}
