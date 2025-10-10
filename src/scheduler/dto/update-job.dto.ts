import { IsString, IsObject, IsOptional, IsInt, Min, Max, Length, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../enums';

export class UpdateJobDto {
  @ApiPropertyOptional({
    description: 'Update job name',
    minLength: 1,
    maxLength: 255,
    example: 'Updated Job Name',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Update job priority',
    minimum: 1,
    maximum: 15,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Update maximum retry attempts',
    minimum: 0,
    maximum: 10,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Update job payload',
    example: {
      updatedField: 'new value',
      additionalData: 'extra information',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Update job metadata',
    example: {
      updatedBy: 'admin',
      lastModified: '2024-01-15T10:30:00Z',
      notes: 'Updated for better performance',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Update job status',
    enum: JobStatus,
    example: JobStatus.PAUSED,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}

export class UpdateJobStatusDto {
  @ApiPropertyOptional({
    description: 'New job status',
    enum: JobStatus,
    example: JobStatus.PAUSED,
  })
  @IsEnum(JobStatus)
  status: JobStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Paused for maintenance',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class UpdateJobMetadataDto {
  @ApiPropertyOptional({
    description: 'Metadata updates to merge with existing metadata',
    example: {
      tags: ['updated', 'high-priority'],
      notes: 'Performance optimizations applied',
      lastReviewedBy: 'john.doe@company.com',
    },
  })
  @IsObject()
  metadata: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether to replace all metadata (true) or merge (false)',
    default: false,
    example: false,
  })
  @IsOptional()
  replace?: boolean;
}
