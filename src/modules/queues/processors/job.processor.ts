import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchedulerService } from '@/modules/scheduler/services/scheduler.service';

// concurrency env-driven pour scaler sous burst (default 1 sinon, queue grossit unboundedly)
const PARSED_CONCURRENCY = parseInt(process.env.BULL_CONCURRENCY ?? '5', 10);
const CONCURRENCY = Number.isFinite(PARSED_CONCURRENCY) ? Math.max(1, PARSED_CONCURRENCY) : 1;
// maxStalledCount aligne avec attempts pour ne pas drop silencieusement les jobs OOM-killed
const MAX_STALLED_COUNT = 5;

@Processor('high-priority', { concurrency: CONCURRENCY, maxStalledCount: MAX_STALLED_COUNT })
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

	// listener visible Sonar/Loki si un job echoue apres tous les retries (alerting)
	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		this.logger.warn('High priority worker failed event', {
			bullJobId: job?.id,
			attemptsMade: job?.attemptsMade,
			error: err?.message,
		});
	}
}

@Processor('medium-priority', { concurrency: CONCURRENCY, maxStalledCount: MAX_STALLED_COUNT })
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

	// listener visible Sonar/Loki si un job echoue apres tous les retries (alerting)
	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		this.logger.warn('Medium priority worker failed event', {
			bullJobId: job?.id,
			attemptsMade: job?.attemptsMade,
			error: err?.message,
		});
	}
}

@Processor('low-priority', { concurrency: CONCURRENCY, maxStalledCount: MAX_STALLED_COUNT })
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

	// listener visible Sonar/Loki si un job echoue apres tous les retries (alerting)
	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error): void {
		this.logger.warn('Low priority worker failed event', {
			bullJobId: job?.id,
			attemptsMade: job?.attemptsMade,
			error: err?.message,
		});
	}
}
