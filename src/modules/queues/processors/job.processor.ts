import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchedulerService } from '@/modules/scheduler/services/scheduler.service';

// concurrency env-driven pour scaler sous burst (default 1 sinon, queue grossit unboundedly)
const PARSED_CONCURRENCY = parseInt(process.env.BULL_CONCURRENCY ?? '5', 10);
const CONCURRENCY = Number.isFinite(PARSED_CONCURRENCY) ? Math.max(1, PARSED_CONCURRENCY) : 1;
// maxStalledCount aligne avec attempts pour ne pas drop silencieusement les jobs OOM-killed
const MAX_STALLED_COUNT = 5;

// options worker partagees par les trois processors (concurrency + maxStalledCount)
const WORKER_OPTS = { concurrency: CONCURRENCY, maxStalledCount: MAX_STALLED_COUNT };

// helper alerting commun : log warn-level pour Sonar/Loki sur job echoue apres tous les retries
function logFailedEvent(logger: Logger, label: string, job: Job, err: Error): void {
	logger.warn(`${label} worker failed event`, {
		bullJobId: job?.id,
		attemptsMade: job?.attemptsMade,
		error: err?.message,
	});
}

@Processor('high-priority', WORKER_OPTS)
export class HighPriorityJobProcessor extends WorkerHost {
	private readonly logger = new Logger(HighPriorityJobProcessor.name);

	constructor(private schedulerService: SchedulerService) {
		super();
	}

	async process(job: Job): Promise<any> {
		// Only process 'execute-job' jobs
		if (job.name !== 'execute-job') {
			return;
		}

		const { jobId, scheduleId } = job.data;

		this.logger.log('Processing high priority job', {
			jobId,
			scheduleId,
			bullJobId: job.id,
		});

		try {
			const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

			this.logger.log('High priority job completed', {
				jobId,
				executionId: result.id,
				status: result.status,
			});

			return result;
		} catch (error) {
			this.logger.error('High priority job failed', {
				jobId,
				scheduleId,
				error: error.message,
			});
			throw error;
		}
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		logFailedEvent(this.logger, 'High priority', job, err);
	}
}

@Processor('medium-priority', WORKER_OPTS)
export class MediumPriorityJobProcessor extends WorkerHost {
	private readonly logger = new Logger(MediumPriorityJobProcessor.name);

	constructor(private schedulerService: SchedulerService) {
		super();
	}

	async process(job: Job): Promise<any> {
		// Only process 'execute-job' jobs
		if (job.name !== 'execute-job') {
			return;
		}

		const { jobId, scheduleId } = job.data;

		this.logger.log('Processing medium priority job', {
			jobId,
			scheduleId,
			bullJobId: job.id,
		});

		try {
			const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

			this.logger.log('Medium priority job completed', {
				jobId,
				executionId: result.id,
				status: result.status,
			});

			return result;
		} catch (error) {
			this.logger.error('Medium priority job failed', {
				jobId,
				scheduleId,
				error: error.message,
			});
			throw error;
		}
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		logFailedEvent(this.logger, 'Medium priority', job, err);
	}
}

@Processor('low-priority', WORKER_OPTS)
export class LowPriorityJobProcessor extends WorkerHost {
	private readonly logger = new Logger(LowPriorityJobProcessor.name);

	constructor(private schedulerService: SchedulerService) {
		super();
	}

	async process(job: Job): Promise<any> {
		// Only process 'execute-job' jobs
		if (job.name !== 'execute-job') {
			return;
		}

		const { jobId, scheduleId } = job.data;

		this.logger.log('Processing low priority job', {
			jobId,
			scheduleId,
			bullJobId: job.id,
		});

		try {
			const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

			this.logger.log('Low priority job completed', {
				jobId,
				executionId: result.id,
				status: result.status,
			});

			return result;
		} catch (error) {
			this.logger.error('Low priority job failed', {
				jobId,
				scheduleId,
				error: error.message,
			});
			throw error;
		}
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		logFailedEvent(this.logger, 'Low priority', job, err);
	}
}
