import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobCategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  defaultPriority: string;

  @ApiProperty()
  defaultTimeout: number;

  @ApiProperty()
  defaultMaxRetries: number;

  @ApiProperty()
  configuration: string;

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

  @ApiProperty({ enum: ['CRON', 'INTERVAL', 'ONCE', 'IMMEDIATE'] })
  scheduleType: string;

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

  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'] })
  status: string;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  failedAt?: Date;

  @ApiProperty()
  attemptNumber: number;

  @ApiPropertyOptional()
  resultData?: string;

  @ApiPropertyOptional()
  errorData?: string;

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
  payload: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  priority: string;

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