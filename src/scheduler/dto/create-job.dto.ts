import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsInt,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '../enums';

export class CreateJobDto {
  @ApiProperty({
    description: 'Human-readable name for the job',
    example: 'Send Welcome Email',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({
    description: 'Type of job to be executed',
    enum: JobType,
    example: JobType.MESSAGE_DELIVERY,
  })
  @IsEnum(JobType)
  type: JobType;

  @ApiProperty({
    description: 'Job payload data',
    example: {
      messageId: '123e4567-e89b-12d3-a456-426614174000',
      recipients: ['user1@example.com', 'user2@example.com'],
      template: 'welcome_email',
      variables: {
        userName: 'John Doe',
        companyName: 'ACME Corp',
      },
    },
  })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Job priority (higher numbers = higher priority)',
    minimum: 1,
    maximum: 15,
    default: 1,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of retry attempts',
    minimum: 0,
    maximum: 10,
    default: 3,
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the job',
    example: {
      source: 'user_registration',
      environment: 'production',
      version: '1.0.0',
      tags: ['email', 'welcome', 'user_onboarding'],
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateScheduleInlineDto {
  @ApiProperty({
    description: 'Cron expression for scheduling',
    example: '0 9 * * MON-FRI',
  })
  @IsString()
  @Length(9, 100)
  cronExpression: string;

  @ApiPropertyOptional({
    description: 'Timezone for the schedule',
    default: 'UTC',
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Schedule start date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  startAt?: Date;

  @ApiPropertyOptional({
    description: 'Schedule end date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  endAt?: Date;

  @ApiPropertyOptional({
    description: 'Maximum number of executions',
    minimum: 1,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxExecutions?: number;

  @ApiPropertyOptional({
    description: 'Schedule metadata',
    example: {
      description: 'Daily report generation',
      owner: 'analytics_team',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateJobWithScheduleDto extends CreateJobDto {
  @ApiProperty({
    description: 'Schedule configuration for the job',
  })
  @ValidateNested()
  @Type(() => CreateScheduleInlineDto)
  schedule: CreateScheduleInlineDto;
}
