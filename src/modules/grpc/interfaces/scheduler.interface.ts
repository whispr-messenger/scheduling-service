// Generated gRPC service interfaces for Whispr Scheduler Service

export interface SchedulerServiceClient {
	createJob(request: CreateJobRequest): Promise<JobResponse>;
	getJob(request: GetJobRequest): Promise<JobResponse>;
	scheduleJob(request: ScheduleJobRequest): Promise<ScheduleResponse>;
	executeJob(request: ExecuteJobRequest): Promise<ExecutionResponse>;
	cancelSchedule(request: CancelScheduleRequest): Promise<void>;
	healthCheck(): Promise<HealthResponse>;
	getMetrics(): Promise<MetricsResponse>;
}

export enum Priority {
	PRIORITY_UNSPECIFIED = 0,
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3,
	CRITICAL = 4,
}

export enum ScheduleType {
	SCHEDULE_TYPE_UNSPECIFIED = 0,
	CRON = 1,
	INTERVAL = 2,
	ONCE = 3,
	IMMEDIATE = 4,
}

export enum ExecutionStatus {
	EXECUTION_STATUS_UNSPECIFIED = 0,
	PENDING = 1,
	RUNNING = 2,
	COMPLETED = 3,
	FAILED = 4,
	CANCELLED = 5,
	TIMEOUT = 6,
}

export interface CreateJobRequest {
	name: string;
	description?: string;
	categoryId: string;
	targetService: string;
	targetMethod: string;
	payload: string; // JSON string
	priority?: Priority;
	maxRetries?: number;
	timeoutSeconds?: number;
	createdBy?: string;
}

export interface GetJobRequest {
	jobId: string;
}

export interface ScheduleJobRequest {
	jobId: string;
	scheduleType: ScheduleType;
	cronExpression?: string;
	intervalSeconds?: number;
	scheduledAt?: Date;
	timezone?: string;
	startsAt?: Date;
	endsAt?: Date;
}

export interface ExecuteJobRequest {
	jobId: string;
	scheduleId?: string;
	correlationId?: string;
}

export interface CancelScheduleRequest {
	scheduleId: string;
}

export interface JobResponse {
	id: string;
	name: string;
	description?: string;
	categoryId: string;
	targetService: string;
	targetMethod: string;
	payload: string; // JSON string
	priority: Priority;
	maxRetries: number;
	timeoutSeconds: number;
	isActive: boolean;
	createdBy?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ScheduleResponse {
	id: string;
	jobId: string;
	scheduleType: ScheduleType;
	cronExpression?: string;
	intervalSeconds?: number;
	scheduledAt?: Date;
	timezone: string;
	startsAt?: Date;
	endsAt?: Date;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ExecutionResponse {
	id: string;
	jobId: string;
	scheduleId?: string;
	status: ExecutionStatus;
	startedAt: Date;
	completedAt?: Date;
	failedAt?: Date;
	attemptNumber: number;
	resultData?: string; // JSON string
	errorData?: string; // JSON string
	durationMs?: number;
	workerId?: string;
	correlationId?: string;
	createdAt: Date;
}

export interface HealthResponse {
	status: string;
	message: string;
	timestamp: Date;
	details: Record<string, string>;
}

export interface MetricsResponse {
	timestamp: Date;
	jobs: JobMetrics;
	executions: ExecutionMetrics;
	queues: QueueMetrics;
	system: SystemMetrics;
}

export interface JobMetrics {
	total: number;
	active: number;
	completed24h: number;
	failed24h: number;
	pending: number;
}

export interface ExecutionMetrics {
	total: number;
	successful24h: number;
	failed24h: number;
	averageDuration: number;
	successRate: number;
}

export interface QueueMetrics {
	highPriority: QueueStats;
	mediumPriority: QueueStats;
	lowPriority: QueueStats;
}

export interface QueueStats {
	name: string;
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
	paused: number;
}

export interface SystemMetrics {
	uptime: number;
	memoryUsage: number;
	cpuUsage: number;
}
