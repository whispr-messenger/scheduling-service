import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
	private readonly logger = new Logger(QueueService.name);

	constructor(
		@InjectQueue('high-priority') private highPriorityQueue: Queue,
		@InjectQueue('medium-priority') private mediumPriorityQueue: Queue,
		@InjectQueue('low-priority') private lowPriorityQueue: Queue,
		// Used by Phase 1 outbound messaging event dispatch.
		@InjectQueue('messaging-dispatch') private messagingDispatchQueue: Queue,
		private configService: ConfigService
	) {}

	async addJob(queueName: string, jobType: string, data: any, options?: JobsOptions): Promise<Job> {
		const queue = this.getQueue(queueName);

		const jobOptions: JobsOptions = {
			removeOnComplete: 50,
			removeOnFail: 100,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 2000,
			},
			...options,
		};

		this.logger.log('Adding job to queue', {
			queueName,
			jobType,
			jobId: options?.jobId,
			delay: options?.delay,
		});

		const job = await queue.add(jobType, data, jobOptions);

		this.logger.log('Job added successfully', {
			queueName,
			jobType,
			jobId: job.id,
			bullJobId: job.id,
		});

		return job;
	}

	async addRepeatableJob(
		queueName: string,
		jobType: string,
		data: any,
		repeatOptions: { pattern?: string; every?: number; jobId?: string }
	): Promise<Job> {
		const queue = this.getQueue(queueName);

		// Extract jobId from repeatOptions
		const { jobId: customJobId, ...repeatOpts } = repeatOptions;

		const jobOptions: JobsOptions = {
			removeOnComplete: 50,
			removeOnFail: 100,
			repeat: repeatOpts,
			jobId: customJobId,
		};

		this.logger.log('Adding repeatable job to queue', {
			queueName,
			jobType,
			repeatOptions,
		});

		const job = await queue.add(jobType, data, jobOptions);

		this.logger.log('Repeatable job added successfully', {
			queueName,
			jobType,
			jobId: job.id,
			repeatOptions,
		});

		return job;
	}

	async removeJob(jobId: string): Promise<void> {
		const queues = [
			this.highPriorityQueue,
			this.mediumPriorityQueue,
			this.lowPriorityQueue,
			this.messagingDispatchQueue,
		];

		for (const queue of queues) {
			try {
				// Try to find and remove the job from each queue
				const job = await queue.getJob(jobId);
				if (job) {
					await job.remove();
					this.logger.log('Job removed from queue', {
						queueName: queue.name,
						jobId,
					});
					return;
				}

				// Also try to remove repeatable jobs
				const repeatableJobs = await queue.getRepeatableJobs();
				const repeatableJob = repeatableJobs.find((j) => j.id === jobId || j.key === jobId);
				if (repeatableJob) {
					await queue.removeRepeatableByKey(repeatableJob.key);
					this.logger.log('Repeatable job removed from queue', {
						queueName: queue.name,
						jobId,
					});
					return;
				}
			} catch (error) {
				this.logger.warn('Failed to remove job from queue', {
					queueName: queue.name,
					jobId,
					error: error.message,
				});
			}
		}

		this.logger.warn('Job not found in any queue', { jobId });
	}

	async getJobStatus(queueName: string, jobId: string): Promise<any> {
		const queue = this.getQueue(queueName);
		const job = await queue.getJob(jobId);

		if (!job) {
			return null;
		}

		const state = await job.getState();

		return {
			id: job.id,
			name: job.name,
			data: job.data,
			opts: job.opts,
			delay: job.opts.delay,
			progress: job.progress,
			timestamp: job.timestamp,
			attemptsMade: job.attemptsMade,
			failedReason: job.failedReason,
			stacktrace: job.stacktrace,
			returnvalue: job.returnvalue,
			finishedOn: job.finishedOn,
			processedOn: job.processedOn,
			state,
		};
	}

	async getQueueStats(queueName: string): Promise<any> {
		const queue = this.getQueue(queueName);

		const [waitingJobs, activeJobs, completedJobs, failedJobs, delayedJobs, isPaused] = await Promise.all(
			[
				queue.getWaiting(),
				queue.getActive(),
				queue.getCompleted(),
				queue.getFailed(),
				queue.getDelayed(),
				queue.isPaused(),
			]
		);

		return {
			queueName,
			counts: {
				waiting: waitingJobs.length,
				active: activeJobs.length,
				completed: completedJobs.length,
				failed: failedJobs.length,
				delayed: delayedJobs.length,
				paused: isPaused ? 1 : 0,
			},
			jobs: {
				waiting: waitingJobs.slice(0, 10), // Return first 10 for preview
				active: activeJobs.slice(0, 10),
				failed: failedJobs.slice(0, 10),
			},
		};
	}

	async getAllQueueStats(): Promise<any[]> {
		const queueNames = ['high-priority', 'medium-priority', 'low-priority', 'messaging-dispatch'];
		const stats = await Promise.all(queueNames.map((name) => this.getQueueStats(name)));

		return stats;
	}

	async cleanQueue(queueName: string, grace: number = 5000): Promise<void> {
		const queue = this.getQueue(queueName);

		await queue.clean(grace, 100, 'completed');
		await queue.clean(grace, 100, 'failed');

		this.logger.log('Queue cleaned', { queueName, grace });
	}

	async pauseQueue(queueName: string): Promise<void> {
		const queue = this.getQueue(queueName);
		await queue.pause();

		this.logger.log('Queue paused', { queueName });
	}

	async resumeQueue(queueName: string): Promise<void> {
		const queue = this.getQueue(queueName);
		await queue.resume();

		this.logger.log('Queue resumed', { queueName });
	}

	async retryFailedJobs(queueName: string): Promise<number> {
		const queue = this.getQueue(queueName);
		const failedJobs = await queue.getFailed();

		let retriedCount = 0;
		for (const job of failedJobs) {
			try {
				await job.retry();
				retriedCount++;
			} catch (error) {
				this.logger.warn('Failed to retry job', {
					jobId: job.id,
					error: error.message,
				});
			}
		}

		this.logger.log('Failed jobs retried', {
			queueName,
			totalFailed: failedJobs.length,
			retriedCount,
		});

		return retriedCount;
	}

	private getQueue(queueName: string): Queue {
		switch (queueName) {
			case 'high-priority':
				return this.highPriorityQueue;
			case 'medium-priority':
				return this.mediumPriorityQueue;
			case 'low-priority':
				return this.lowPriorityQueue;
			case 'messaging-dispatch':
				return this.messagingDispatchQueue;
			default:
				throw new Error(`Unknown queue: ${queueName}`);
		}
	}
}
