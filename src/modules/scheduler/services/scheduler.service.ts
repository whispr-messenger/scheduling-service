/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Injectable,
	Logger,
	NotFoundException,
	BadRequestException,
	InternalServerErrorException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateJobDto } from '../dto/create-job.dto';
import { ScheduleJobDto } from '../dto/schedule-job.dto';
import { JobResponseDto, ScheduleResponseDto, ExecutionResponseDto } from '../dto/job-response.dto';
import { Job, Schedule, Execution, JobCategory, Priority, ScheduleType, ExecutionStatus } from '../entities';
import { CronUtil } from '@/common/utils/cron.util';
import { TimezoneUtil } from '@/common/utils/timezone.util';
import { RetryUtil } from '@/common/utils/retry.util';
import { QueueService } from '@/modules/queues/services/queue.service';
import { MessagingGrpcClient } from '@/modules/grpc/clients/messaging.client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SchedulerService {
	private readonly logger = new Logger(SchedulerService.name);

	constructor(
		@InjectRepository(Job)
		private readonly jobRepository: Repository<Job>,
		@InjectRepository(Schedule)
		private readonly scheduleRepository: Repository<Schedule>,
		@InjectRepository(Execution)
		private readonly executionRepository: Repository<Execution>,
		@InjectRepository(JobCategory)
		private readonly jobCategoryRepository: Repository<JobCategory>,
		private readonly queueService: QueueService,
		@Inject(forwardRef(() => MessagingGrpcClient))
		private readonly messagingClient: MessagingGrpcClient
	) {}

	async createJob(createJobDto: CreateJobDto): Promise<JobResponseDto> {
		this.logger.log('Creating new job', { name: createJobDto.name });

		try {
			// Validate category exists
			const category = await this.jobCategoryRepository.findOne({
				where: { id: createJobDto.categoryId },
			});

			if (!category) {
				throw new NotFoundException(`Job category with ID ${createJobDto.categoryId} not found`);
			}

			// Apply defaults from category if not provided
			const job = this.jobRepository.create({
				...createJobDto,
				priority: createJobDto.priority || category.defaultPriority,
				maxRetries: createJobDto.maxRetries ?? category.defaultMaxRetries,
				timeoutSeconds: createJobDto.timeoutSeconds ?? category.defaultTimeout,
			});

			const savedJob = await this.jobRepository.save(job);

			// Load the category relation
			const jobWithCategory = await this.jobRepository.findOne({
				where: { id: savedJob.id },
				relations: ['category'],
			});

			if (!jobWithCategory) {
				throw new InternalServerErrorException('Failed to retrieve created job');
			}

			this.logger.log('Job created successfully', {
				jobId: jobWithCategory.id,
				name: jobWithCategory.name,
			});

			return this.mapJobToResponse(jobWithCategory);
		} catch (error) {
			this.logger.error('Failed to create job', { error: error.message, dto: createJobDto });
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to create job');
		}
	}

	async scheduleJob(scheduleJobDto: ScheduleJobDto): Promise<ScheduleResponseDto> {
		this.logger.log('Scheduling job', { jobId: scheduleJobDto.jobId });

		try {
			// Validate custom DTO
			const validationErrors = scheduleJobDto.validate();
			if (validationErrors.length > 0) {
				throw new BadRequestException(`Validation failed: ${validationErrors.join(', ')}`);
			}

			// Validate job exists
			const job = await this.jobRepository.findOne({
				where: { id: scheduleJobDto.jobId },
				relations: ['category'],
			});

			if (!job) {
				throw new NotFoundException(`Job with ID ${scheduleJobDto.jobId} not found`);
			}

			if (!job.isActive) {
				throw new BadRequestException('Cannot schedule inactive job');
			}

			// Create schedule
			const schedule = this.scheduleRepository.create({
				jobId: scheduleJobDto.jobId,
				scheduleType: scheduleJobDto.scheduleType,
				cronExpression: scheduleJobDto.cronExpression || null,
				intervalSeconds: scheduleJobDto.intervalSeconds || null,
				scheduledAt: scheduleJobDto.scheduledAt ? new Date(scheduleJobDto.scheduledAt) : null,
				timezone: scheduleJobDto.timezone || 'UTC',
				startsAt: scheduleJobDto.startsAt ? new Date(scheduleJobDto.startsAt) : null,
				endsAt: scheduleJobDto.endsAt ? new Date(scheduleJobDto.endsAt) : null,
			});

			const savedSchedule = await this.scheduleRepository.save(schedule);

			// Add to queue based on schedule type
			await this.addToQueue(job, savedSchedule);

			this.logger.log('Job scheduled successfully', {
				scheduleId: savedSchedule.id,
				jobId: job.id,
				scheduleType: savedSchedule.scheduleType,
			});

			return this.mapScheduleToResponse(savedSchedule);
		} catch (error) {
			this.logger.error('Failed to schedule job', { error: error.message, dto: scheduleJobDto });
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to schedule job');
		}
	}

	async executeJob(
		jobId: string,
		scheduleId?: string,
		correlationId?: string
	): Promise<ExecutionResponseDto> {
		const executionId = uuidv4();
		const startTime = Date.now();

		this.logger.log('Starting job execution', {
			executionId,
			jobId,
			scheduleId,
			correlationId,
		});

		// Validate job exists before creating execution record
		const job = await this.jobRepository.findOne({
			where: { id: jobId },
			relations: ['category'],
		});

		if (!job) {
			throw new NotFoundException(`Job with ID ${jobId} not found`);
		}

		// Create execution record
		const execution = this.executionRepository.create({
			id: executionId,
			jobId,
			scheduleId: scheduleId || null,
			status: ExecutionStatus.RUNNING,
			correlationId: correlationId || uuidv4(),
			startedAt: new Date(),
		});

		const savedExecution = await this.executionRepository.save(execution);

		try {
			// Execute job with timeout
			const result = await this.executeWithTimeout(job, job.timeoutSeconds * 1000);

			// Update execution with success
			const duration = Date.now() - startTime;
			savedExecution.status = ExecutionStatus.COMPLETED;
			savedExecution.completedAt = new Date();
			savedExecution.resultData = result;
			savedExecution.durationMs = duration;

			const updatedExecution = await this.executionRepository.save(savedExecution);

			this.logger.log('Job execution completed successfully', {
				executionId,
				jobId,
				duration,
			});

			return this.mapExecutionToResponse(updatedExecution);
		} catch (error) {
			// Update execution with failure
			const duration = Date.now() - startTime;
			savedExecution.status = ExecutionStatus.FAILED;
			savedExecution.failedAt = new Date();
			// Ne pas persister la stack trace : elle contient des chemins internes
			// (/app/src/...) qui facilitent le fingerprinting du runtime en cas de
			// fuite de l'API. La stack reste disponible dans les logs serveur ci-dessous.
			savedExecution.errorData = {
				error: error.message,
				code: (error.code as string | undefined) ?? null,
			};
			savedExecution.durationMs = duration;

			const updatedExecution = await this.executionRepository.save(savedExecution);

			this.logger.error('Job execution failed', {
				executionId,
				jobId,
				error: error.message,
				stack: error.stack,
				duration,
			});

			return this.mapExecutionToResponse(updatedExecution);
		}
	}

	async getJob(jobId: string): Promise<JobResponseDto> {
		const job = await this.jobRepository.findOne({
			where: { id: jobId },
			relations: ['category'],
		});

		if (!job) {
			throw new NotFoundException(`Job with ID ${jobId} not found`);
		}

		return this.mapJobToResponse(job);
	}

	async getJobExecutions(jobId: string, limit = 50, offset = 0): Promise<ExecutionResponseDto[]> {
		const executions = await this.executionRepository.find({
			where: { jobId },
			order: { startedAt: 'DESC' },
			take: limit,
			skip: offset,
		});

		return executions.map((execution) => this.mapExecutionToResponse(execution));
	}

	async getSchedules(jobId?: string): Promise<ScheduleResponseDto[]> {
		const whereCondition = jobId ? { jobId } : {};
		const schedules = await this.scheduleRepository.find({
			where: whereCondition,
			order: { createdAt: 'DESC' },
		});

		return schedules.map((schedule) => this.mapScheduleToResponse(schedule));
	}

	async cancelSchedule(scheduleId: string): Promise<void> {
		const schedule = await this.scheduleRepository.findOne({
			where: { id: scheduleId },
		});

		if (!schedule) {
			throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
		}

		schedule.isActive = false;
		await this.scheduleRepository.save(schedule);

		// Remove from queue
		await this.queueService.removeJob(scheduleId);

		this.logger.log('Schedule cancelled', { scheduleId });
	}

	private async addToQueue(job: Job, schedule: Schedule): Promise<void> {
		const queueName = this.getQueueName(job.priority);

		switch (schedule.scheduleType) {
			case ScheduleType.IMMEDIATE:
				await this.queueService.addJob(queueName, 'execute-job', {
					jobId: job.id,
					scheduleId: schedule.id,
				});
				break;

			case ScheduleType.ONCE:
				if (schedule.scheduledAt) {
					const delay = schedule.scheduledAt.getTime() - Date.now();
					await this.queueService.addJob(
						queueName,
						'execute-job',
						{
							jobId: job.id,
							scheduleId: schedule.id,
						},
						{
							delay: Math.max(0, delay),
							jobId: schedule.id,
						}
					);
				}
				break;

			case ScheduleType.CRON:
				if (schedule.cronExpression) {
					await this.queueService.addRepeatableJob(
						queueName,
						'execute-job',
						{
							jobId: job.id,
							scheduleId: schedule.id,
						},
						{
							cron: schedule.cronExpression,
							tz: schedule.timezone,
							jobId: schedule.id,
						} as any
					);
				}
				break;

			case ScheduleType.INTERVAL:
				if (schedule.intervalSeconds) {
					await this.queueService.addRepeatableJob(
						queueName,
						'execute-job',
						{
							jobId: job.id,
							scheduleId: schedule.id,
						},
						{
							every: schedule.intervalSeconds * 1000,
							jobId: schedule.id,
						} as any
					);
				}
				break;
		}
	}

	private async executeWithTimeout(job: Job, timeoutMs: number): Promise<any> {
		const timeout = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Job execution timeout')), timeoutMs);
		});

		const execution = this.executeJobByService(job);

		return Promise.race([execution, timeout]);
	}

	private async executeJobByService(job: Job): Promise<any> {
		this.logger.log('Executing job', {
			jobId: job.id,
			targetService: job.targetService,
			targetMethod: job.targetMethod,
		});

		try {
			// Route to appropriate service based on targetService
			switch (job.targetService) {
				case 'messaging':
					return await this.executeMessagingJob(job);

				case 'notification':
					return await this.executeNotificationJob(job);

				default:
					this.logger.warn('Unknown target service, returning simulated result', {
						targetService: job.targetService,
					});
					return {
						service: job.targetService,
						method: job.targetMethod,
						payload: job.payload,
						executedAt: new Date().toISOString(),
						status: 'simulated',
					};
			}
		} catch (error) {
			this.logger.error('Failed to execute job by service', {
				jobId: job.id,
				targetService: job.targetService,
				error: error.message,
			});
			throw error;
		}
	}

	private async executeMessagingJob(job: Job): Promise<any> {
		const payload = job.payload as any;

		switch (job.targetMethod) {
			case 'sendScheduledMessage':
				return await this.messagingClient.sendScheduledMessage({
					conversationId: payload.conversationId,
					senderId: payload.senderId,
					messageType: payload.messageType || 'TEXT',
					content: payload.content,
					metadata: payload.metadata,
					scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : new Date(),
				});

			case 'cleanupExpiredMessages':
				return await this.messagingClient.cleanupExpiredMessages({
					olderThan: new Date(payload.olderThan),
					batchSize: payload.batchSize,
				});

			default:
				throw new Error(`Unknown messaging method: ${job.targetMethod}`);
		}
	}

	private async executeNotificationJob(job: Job): Promise<any> {
		this.logger.warn('Notification job executed with placeholder', {
			targetMethod: job.targetMethod,
		});

		return {
			service: 'notification',
			method: job.targetMethod,
			payload: job.payload,
			executedAt: new Date().toISOString(),
			status: 'placeholder',
		};
	}

	private getQueueName(priority: Priority): string {
		switch (priority) {
			case Priority.CRITICAL:
			case Priority.HIGH:
				return 'high-priority';
			case Priority.MEDIUM:
				return 'medium-priority';
			case Priority.LOW:
				return 'low-priority';
			default:
				return 'medium-priority';
		}
	}

	private mapJobToResponse(job: Job & { category?: any }): JobResponseDto {
		return {
			id: job.id,
			name: job.name,
			description: job.description ?? undefined,
			categoryId: job.categoryId,
			targetService: job.targetService,
			targetMethod: job.targetMethod,
			payload: job.payload as Record<string, any>,
			priority: job.priority,
			maxRetries: job.maxRetries,
			timeoutSeconds: job.timeoutSeconds,
			isActive: job.isActive,
			createdBy: job.createdBy ?? undefined,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
			deletedAt: job.deletedAt ?? undefined,
		};
	}

	private mapScheduleToResponse(schedule: Schedule): ScheduleResponseDto {
		return {
			id: schedule.id,
			jobId: schedule.jobId,
			scheduleType: schedule.scheduleType,
			cronExpression: schedule.cronExpression ?? undefined,
			intervalSeconds: schedule.intervalSeconds ?? undefined,
			scheduledAt: schedule.scheduledAt ?? undefined,
			timezone: schedule.timezone,
			startsAt: schedule.startsAt ?? undefined,
			endsAt: schedule.endsAt ?? undefined,
			isActive: schedule.isActive,
			createdAt: schedule.createdAt,
			updatedAt: schedule.updatedAt,
		};
	}

	private mapExecutionToResponse(execution: Execution): ExecutionResponseDto {
		return {
			id: execution.id,
			jobId: execution.jobId,
			scheduleId: execution.scheduleId ?? undefined,
			status: execution.status,
			startedAt: execution.startedAt,
			completedAt: execution.completedAt ?? undefined,
			failedAt: execution.failedAt ?? undefined,
			attemptNumber: execution.attemptNumber,
			resultData: execution.resultData as Record<string, any> | undefined,
			errorData: execution.errorData as Record<string, any> | undefined,
			durationMs: execution.durationMs ?? undefined,
			workerId: execution.workerId ?? undefined,
			correlationId: execution.correlationId ?? undefined,
			createdAt: execution.createdAt,
		};
	}
}
