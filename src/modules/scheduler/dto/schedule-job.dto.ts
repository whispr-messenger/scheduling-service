import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsEnum,
	IsInt,
	IsDateString,
	IsUUID,
	ValidateIf,
	Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '../entities/enums';
import { TimezoneUtil } from '@/common/utils/timezone.util';
import { CronUtil } from '@/common/utils/cron.util';

export class ScheduleJobDto {
	@ApiProperty({
		description: 'Job ID to schedule',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	@IsUUID()
	@IsNotEmpty()
	jobId: string;

	@ApiProperty({
		description: 'Type of schedule',
		enum: ScheduleType,
		example: ScheduleType.CRON,
	})
	@IsEnum(ScheduleType)
	scheduleType: ScheduleType;

	@ApiPropertyOptional({
		description: 'Cron expression for CRON type schedules',
		example: '0 9 * * 1',
	})
	@ValidateIf((o) => o.scheduleType === ScheduleType.CRON)
	@IsString()
	@IsNotEmpty()
	cronExpression?: string;

	@ApiPropertyOptional({
		description: 'Interval in seconds for INTERVAL type schedules',
		example: 3600,
		minimum: 60,
	})
	@ValidateIf((o) => o.scheduleType === ScheduleType.INTERVAL)
	@IsInt()
	@Min(60)
	intervalSeconds?: number;

	@ApiPropertyOptional({
		description: 'Specific date and time for ONCE type schedules',
		example: '2025-01-15T10:00:00Z',
	})
	@ValidateIf((o) => o.scheduleType === ScheduleType.ONCE)
	@IsDateString()
	scheduledAt?: string;

	@ApiPropertyOptional({
		description: 'Timezone for the schedule',
		example: 'Europe/Paris',
		default: 'UTC',
	})
	@IsOptional()
	@IsString()
	timezone?: string;

	@ApiPropertyOptional({
		description: 'Start date for the schedule validity',
		example: '2025-01-01T00:00:00Z',
	})
	@IsOptional()
	@IsDateString()
	startsAt?: string;

	@ApiPropertyOptional({
		description: 'End date for the schedule validity',
		example: '2025-12-31T23:59:59Z',
	})
	@IsOptional()
	@IsDateString()
	endsAt?: string;

	// Custom validation
	validate(): string[] {
		const errors: string[] = [];

		// Validate cron expression if provided
		if (this.cronExpression && !CronUtil.isValidCronExpression(this.cronExpression)) {
			errors.push('Invalid cron expression');
		}

		// Validate timezone if provided
		if (this.timezone && !TimezoneUtil.isValidTimezone(this.timezone)) {
			errors.push('Invalid timezone');
		}

		// Validate date ranges
		if (this.startsAt && this.endsAt) {
			const start = new Date(this.startsAt);
			const end = new Date(this.endsAt);
			if (start >= end) {
				errors.push('Start date must be before end date');
			}
		}

		// Validate scheduled date is in the future for ONCE type
		if (this.scheduleType === ScheduleType.ONCE && this.scheduledAt) {
			const scheduledDate = new Date(this.scheduledAt);
			const now = new Date();
			if (scheduledDate <= now) {
				errors.push('Scheduled date must be in the future');
			}
		}

		return errors;
	}
}
