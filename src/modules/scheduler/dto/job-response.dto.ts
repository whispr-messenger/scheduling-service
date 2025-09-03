import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ScheduleType, ExecutionStatus } from '@prisma/client';

export class JobCategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: Priority })
  defaultPriority: Priority;

  @ApiProperty()
  defaultTimeout: number;

  @ApiProperty()
  defaultMaxRetries: number;

  @ApiProperty()
  configuration: Record<string, any>;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: ScheduleType })
  scheduleType: ScheduleType;

  @ApiPropertyOptional()
  cronExpression?: string;

  @ApiPropertyOptional()
  intervalSeconds?: number;

  @ApiPropertyOptional()
  scheduledAt?: Date;

  @ApiProperty()
  timezone: string;

  @ApiPropertyOptional()
  startsAt?: Date;

  @ApiPropertyOptional()
  endsAt?: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ExecutionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiPropertyOptional()
  scheduleId?: string;

  @ApiProperty({ enum: ExecutionStatus })
  status: ExecutionStatus;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  failedAt?: Date;

  @ApiProperty()
  attemptNumber: number;

  @ApiPropertyOptional()
  resultData?: Record<string, any>;

  @ApiPropertyOptional()
  errorData?: Record<string, any>;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiPropertyOptional()
  workerId?: string;

  @ApiPropertyOptional()
  correlationId?: string;

  @ApiProperty()
  createdAt: Date;
}

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  targetService: string;

  @ApiProperty()
  targetMethod: string;

  @ApiProperty()
  payload: Record<string, any>;

  @ApiProperty({ enum: Priority })
  priority: Priority;

  @ApiProperty()
  maxRetries: number;

  @ApiProperty()
  timeoutSeconds: number;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;

  @ApiPropertyOptional({ type: JobCategoryResponseDto })
  category?: JobCategoryResponseDto;

  @ApiPropertyOptional({ type: [ScheduleResponseDto] })
  schedules?: ScheduleResponseDto[];

  @ApiPropertyOptional({ type: [ExecutionResponseDto] })
  executions?: ExecutionResponseDto[];
}