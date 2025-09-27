import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Job } from './entities/job.entity';
import { Schedule } from './entities/schedule.entity';
import { JobExecution } from './entities/job-execution.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { JobStatus, JobType, ExecutionStatus } from './enums';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(JobExecution)
    private readonly executionRepository: Repository<JobExecution>,
    @InjectQueue('scheduler')
    private readonly schedulerQueue: Queue,
  ) {}

  /**
   * Create a new job
   */
  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    this.logger.log(`Creating job: ${createJobDto.name}`);

    const job = this.jobRepository.create({
      ...createJobDto,
      priority: createJobDto.priority || 1,
      maxRetries: createJobDto.maxRetries || 3,
      metadata: createJobDto.metadata || {},
    });

    const savedJob = await this.jobRepository.save(job);
    this.logger.log(`Job created with ID: ${savedJob.id}`);

    return savedJob;
  }

  /**
   * Find job by ID
   */
  async findJobById(id: string): Promise<Job | null> {
    return this.jobRepository.findOne({
      where: { id },
      relations: ['schedule', 'executions'],
    });
  }

  /**
   * Update a job
   */
  async updateJob(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    Object.assign(job, updateJobDto);
    const updatedJob = await this.jobRepository.save(job);

    this.logger.log(`Job updated: ${id}`);
    return updatedJob;
  }

  /**
   * Delete a job
   */
  async deleteJob(id: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Remove from queue if exists
    try {
      await this.schedulerQueue.removeJobs(id);
    } catch (error) {
      this.logger.warn(`Failed to remove job from queue: ${error.message}`);
    }

    await this.jobRepository.delete(id);
    this.logger.log(`Job deleted: ${id}`);
  }

  /**
   * Schedule a job
   */
  async scheduleJob(jobId: string, scheduleDto: CreateScheduleDto): Promise<Schedule> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const schedule = this.scheduleRepository.create({
      jobId,
      ...scheduleDto,
      timezone: scheduleDto.timezone || 'UTC',
      isActive: scheduleDto.isActive !== false,
      metadata: scheduleDto.metadata || {},
    });

    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Add to queue with cron schedule
    await this.schedulerQueue.add(
      job.type,
      { jobId, scheduleId: savedSchedule.id },
      {
        repeat: { cron: scheduleDto.cronExpression },
        jobId: `schedule_${savedSchedule.id}`,
      },
    );

    this.logger.log(`Job scheduled: ${jobId} with schedule: ${savedSchedule.id}`);
    return savedSchedule;
  }

  /**
   * Execute a job immediately
   */
  async executeJob(jobId: string): Promise<JobExecution> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.isExecutable()) {
      throw new BadRequestException('Job is not in an executable state');
    }

    // Create execution record
    const execution = this.executionRepository.create({
      jobId,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      metadata: {},
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Update job status
    job.markAsRunning();
    await this.jobRepository.save(job);

    // Add to immediate execution queue
    await this.schedulerQueue.add(
      job.type,
      { jobId, executionId: savedExecution.id },
      {
        priority: job.priority,
        attempts: job.maxRetries + 1,
      },
    );

    this.logger.log(`Job execution started: ${jobId} -> ${savedExecution.id}`);
    return savedExecution;
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<Record<JobStatus, number>> {
    const stats = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany();

    const result: Record<JobStatus, number> = {
      [JobStatus.PENDING]: 0,
      [JobStatus.RUNNING]: 0,
      [JobStatus.COMPLETED]: 0,
      [JobStatus.FAILED]: 0,
      [JobStatus.PAUSED]: 0,
      [JobStatus.CANCELLED]: 0,
      [JobStatus.RETRY]: 0,
    };

    stats.forEach((stat) => {
      result[stat.status as JobStatus] = parseInt(stat.count, 10);
    });

    return result;
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus, limit: number = 50): Promise<Job[]> {
    return this.jobRepository.find({
      where: { status },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get job executions
   */
  async getJobExecutions(jobId: string): Promise<JobExecution[]> {
    return this.executionRepository.find({
      where: { jobId },
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Pause a job
   */
  async pauseJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    job.markAsPaused();
    const updatedJob = await this.jobRepository.save(job);

    // Pause in queue
    await this.schedulerQueue.pause();

    this.logger.log(`Job paused: ${jobId}`);
    return updatedJob;
  }

  /**
   * Resume a job
   */
  async resumeJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === JobStatus.PAUSED) {
      job.status = JobStatus.PENDING;
      const updatedJob = await this.jobRepository.save(job);

      // Resume queue
      await this.schedulerQueue.resume();

      this.logger.log(`Job resumed: ${jobId}`);
      return updatedJob;
    }

    return job;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    job.markAsCancelled();
    const updatedJob = await this.jobRepository.save(job);

    // Remove from queue
    try {
      await this.schedulerQueue.removeJobs(jobId);
    } catch (error) {
      this.logger.warn(`Failed to remove job from queue: ${error.message}`);
    }

    this.logger.log(`Job cancelled: ${jobId}`);
    return updatedJob;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.canRetry()) {
      throw new BadRequestException('Job cannot be retried');
    }

    job.status = JobStatus.PENDING;
    const updatedJob = await this.jobRepository.save(job);

    // Re-add to queue
    await this.schedulerQueue.add(
      job.type,
      { jobId },
      {
        priority: job.priority,
        attempts: job.maxRetries - job.retryCount,
      },
    );

    this.logger.log(`Job retry initiated: ${jobId}`);
    return updatedJob;
  }

  /**
   * Get job execution history
   */
  async getJobHistory(jobId: string, limit: number = 20): Promise<JobExecution[]> {
    return this.executionRepository.find({
      where: { jobId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Complete a job execution
   */
  async completeJobExecution(executionId: string, output?: string): Promise<JobExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['job'],
    });

    if (!execution) {
      throw new NotFoundException('Job execution not found');
    }

    execution.markAsCompleted(output);
    const updatedExecution = await this.executionRepository.save(execution);

    // Update job status
    execution.job.markAsCompleted();
    await this.jobRepository.save(execution.job);

    this.logger.log(`Job execution completed: ${executionId}`);
    return updatedExecution;
  }

  /**
   * Fail a job execution
   */
  async failJobExecution(
    executionId: string,
    error: string,
    details?: Record<string, any>,
  ): Promise<JobExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['job'],
    });

    if (!execution) {
      throw new NotFoundException('Job execution not found');
    }

    execution.markAsFailed(error, details);
    const updatedExecution = await this.executionRepository.save(execution);

    // Update job status
    execution.job.markAsFailed(error, details);
    await this.jobRepository.save(execution.job);

    this.logger.error(`Job execution failed: ${executionId} - ${error}`);
    return updatedExecution;
  }
}