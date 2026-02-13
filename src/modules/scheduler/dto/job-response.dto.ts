import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ScheduleType, ExecutionStatus } from '../entities/enums';

export class JobResponseDto {
	@ApiProperty({
		description: 'Job ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	id: string;

	@ApiProperty({
		description: 'Job name',
		example: 'Send welcome email',
	})
	name: string;

	@ApiPropertyOptional({
		description: 'Job description',
		example: 'Send a welcome email to new users',
	})
	description?: string;

	@ApiProperty({
		description: 'Category ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	categoryId: string;

	@ApiProperty({
		description: 'Target service',
		example: 'messaging-service',
	})
	targetService: string;

	@ApiProperty({
		description: 'Target method',
		example: 'sendWelcomeEmail',
	})
	targetMethod: string;

	@ApiProperty({
		description: 'Job payload',
		example: { userId: '123', template: 'welcome' },
	})
	payload: Record<string, any>;

	@ApiProperty({
		description: 'Job priority',
		enum: Priority,
		example: Priority.MEDIUM,
	})
	priority: Priority;

	@ApiProperty({
		description: 'Maximum retry attempts',
		example: 3,
	})
	maxRetries: number;

	@ApiProperty({
		description: 'Timeout in seconds',
		example: 300,
	})
	timeoutSeconds: number;

	@ApiProperty({
		description: 'Whether the job is active',
		example: true,
	})
	isActive: boolean;

	@ApiPropertyOptional({
		description: 'User who created the job',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	createdBy?: string;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	updatedAt: Date;

	@ApiPropertyOptional({
		description: 'Deletion timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	deletedAt?: Date;
}

export class ScheduleResponseDto {
	@ApiProperty({
		description: 'Schedule ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	id: string;

	@ApiProperty({
		description: 'Associated job ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	jobId: string;

	@ApiProperty({
		description: 'Schedule type',
		enum: ScheduleType,
		example: ScheduleType.CRON,
	})
	scheduleType: ScheduleType;

	@ApiPropertyOptional({
		description: 'Cron expression',
		example: '0 9 * * 1',
	})
	cronExpression?: string;

	@ApiPropertyOptional({
		description: 'Interval in seconds',
		example: 3600,
	})
	intervalSeconds?: number;

	@ApiPropertyOptional({
		description: 'Scheduled execution time',
		example: '2025-01-15T10:00:00Z',
	})
	scheduledAt?: Date;

	@ApiProperty({
		description: 'Timezone',
		example: 'UTC',
	})
	timezone: string;

	@ApiPropertyOptional({
		description: 'Schedule start date',
		example: '2025-01-01T00:00:00Z',
	})
	startsAt?: Date;

	@ApiPropertyOptional({
		description: 'Schedule end date',
		example: '2025-12-31T23:59:59Z',
	})
	endsAt?: Date;

	@ApiProperty({
		description: 'Whether the schedule is active',
		example: true,
	})
	isActive: boolean;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	updatedAt: Date;
}

export class ExecutionResponseDto {
	@ApiProperty({
		description: 'Execution ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	id: string;

	@ApiProperty({
		description: 'Associated job ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	jobId: string;

	@ApiPropertyOptional({
		description: 'Associated schedule ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	scheduleId?: string;

	@ApiProperty({
		description: 'Execution status',
		enum: ExecutionStatus,
		example: ExecutionStatus.COMPLETED,
	})
	status: ExecutionStatus;

	@ApiProperty({
		description: 'Execution start time',
		example: '2025-01-15T10:00:00Z',
	})
	startedAt: Date;

	@ApiPropertyOptional({
		description: 'Execution completion time',
		example: '2025-01-15T10:01:30Z',
	})
	completedAt?: Date;

	@ApiPropertyOptional({
		description: 'Execution failure time',
		example: '2025-01-15T10:01:30Z',
	})
	failedAt?: Date;

	@ApiProperty({
		description: 'Attempt number',
		example: 1,
	})
	attemptNumber: number;

	@ApiPropertyOptional({
		description: 'Execution result data',
		example: { messagesSent: 5, successRate: 1.0 },
	})
	resultData?: Record<string, any>;

	@ApiPropertyOptional({
		description: 'Error data if execution failed',
		example: { error: 'Connection timeout', code: 'TIMEOUT' },
	})
	errorData?: Record<string, any>;

	@ApiPropertyOptional({
		description: 'Execution duration in milliseconds',
		example: 1500,
	})
	durationMs?: number;

	@ApiPropertyOptional({
		description: 'Worker ID that executed the job',
		example: 'worker-001',
	})
	workerId?: string;

	@ApiPropertyOptional({
		description: 'Correlation ID for tracing',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	correlationId?: string;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2025-01-15T10:00:00Z',
	})
	createdAt: Date;
}
