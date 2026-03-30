import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './services/queue.service';
import {
	HighPriorityJobProcessor,
	MediumPriorityJobProcessor,
	LowPriorityJobProcessor,
} from './processors/job.processor';
import { SchedulerModule } from '../scheduler/scheduler.module';

const QUEUE_IMPORTS = [forwardRef(() => SchedulerModule)] as any[];
const QUEUE_PROVIDERS = [
	QueueService,
	HighPriorityJobProcessor,
	MediumPriorityJobProcessor,
	LowPriorityJobProcessor,
] as any[];

if (process.env.NODE_ENV !== 'test') {
	QUEUE_IMPORTS.push(
		BullModule.registerQueue(
			{
				name: 'high-priority',
				defaultJobOptions: {
					removeOnComplete: 100,
					removeOnFail: 200,
					attempts: 5,
					backoff: {
						type: 'exponential',
						delay: 1000,
					},
				},
			},
			{
				name: 'medium-priority',
				defaultJobOptions: {
					removeOnComplete: 50,
					removeOnFail: 100,
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 2000,
					},
				},
			},
			{
				name: 'low-priority',
				defaultJobOptions: {
					removeOnComplete: 25,
					removeOnFail: 50,
					attempts: 2,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
			}
		)
	);
} else {
	QUEUE_PROVIDERS.splice(0, QUEUE_PROVIDERS.length, {
		provide: QueueService,
		useValue: {
			addJob: async () => ({ id: 'test' }),
			addRepeatableJob: async () => ({ id: 'test' }),
			removeJob: async () => {},
			getQueueStats: async () => ({
				highPriority: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
				mediumPriority: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
				lowPriority: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
			}),
		},
	});
}

@Module({
	imports: QUEUE_IMPORTS,
	providers: QUEUE_PROVIDERS,
	exports: [QueueService],
})
export class QueuesModule {}
