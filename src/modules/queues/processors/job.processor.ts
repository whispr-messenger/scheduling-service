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

// base partagee par les processors high/medium/low : meme flow d'execution, seul le label change
abstract class BaseJobProcessor extends WorkerHost {
	protected abstract readonly priorityLabel: string;
	protected abstract readonly logger: Logger;

	constructor(private readonly schedulerService: SchedulerService) {
		super();
	}

	async process(job: Job): Promise<any> {
		// on ne traite que les jobs nommes 'execute-job'
		if (job.name !== 'execute-job') {
			return;
		}

		const { jobId, scheduleId } = job.data;

		this.logger.log(`Processing ${this.priorityLabel} priority job`, {
			jobId,
			scheduleId,
			bullJobId: job.id,
		});

		try {
			const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

			this.logger.log(`${this.priorityLabel} priority job completed`, {
				jobId,
				executionId: result.id,
				status: result.status,
			});

			return result;
		} catch (error) {
			this.logger.error(`${this.priorityLabel} priority job failed`, {
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
		this.logger.warn(`${this.priorityLabel} priority worker failed event`, {
			bullJobId: job?.id,
			attemptsMade: job?.attemptsMade,
			error: err?.message,
		});
	}
}

@Processor('high-priority', WORKER_OPTS)
export class HighPriorityJobProcessor extends BaseJobProcessor {
	protected readonly priorityLabel = 'High';
	protected readonly logger = new Logger(HighPriorityJobProcessor.name);
}

@Processor('medium-priority', WORKER_OPTS)
export class MediumPriorityJobProcessor extends BaseJobProcessor {
	protected readonly priorityLabel = 'Medium';
	protected readonly logger = new Logger(MediumPriorityJobProcessor.name);
}

@Processor('low-priority', WORKER_OPTS)
export class LowPriorityJobProcessor extends BaseJobProcessor {
	protected readonly priorityLabel = 'Low';
	protected readonly logger = new Logger(LowPriorityJobProcessor.name);
}
