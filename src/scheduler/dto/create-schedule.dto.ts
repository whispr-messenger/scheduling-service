import { IsString, IsBoolean, IsOptional, IsObject, IsInt, Min, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Cron expression for job scheduling',
    example: '0 9 * * MON-FRI',
    minLength: 9,
    maxLength: 100,
  })
  @IsString()
  @Length(9, 100)
  cronExpression: string;

  @ApiPropertyOptional({
    description: 'Timezone for the schedule',
    default: 'UTC',
    example: 'America/New_York',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Schedule start date and time',
    example: '2024-01-01T09:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  startAt?: Date;

  @ApiPropertyOptional({
    description: 'Schedule end date and time',
    example: '2024-12-31T17:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  endAt?: Date;

  @ApiPropertyOptional({
    description: 'Whether the schedule is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of executions (null for unlimited)',
    minimum: 1,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxExecutions?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the schedule',
    example: {
      description: 'Weekly report generation',
      owner: 'analytics_team',
      alertOnFailure: true,
      retentionDays: 30,
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: 'Update cron expression',
    example: '0 10 * * MON-SAT',
    minLength: 9,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(9, 100)
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Update timezone',
    example: 'Europe/London',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Update schedule start date',
    example: '2024-02-01T09:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  startAt?: Date;

  @ApiPropertyOptional({
    description: 'Update schedule end date',
    example: '2024-11-30T17:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  endAt?: Date;

  @ApiPropertyOptional({
    description: 'Update schedule active status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Update maximum executions',
    minimum: 1,
    example: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxExecutions?: number;

  @ApiPropertyOptional({
    description: 'Update schedule metadata',
    example: {
      description: 'Updated weekly report generation',
      lastModifiedBy: 'admin@company.com',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
