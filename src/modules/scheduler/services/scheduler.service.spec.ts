import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { Job, Schedule, Execution, JobCategory } from '../entities';
import { ExecutionLog, RecurringJob, JobDependency } from '../entities';
import { ExecutionStatus, Priority } from '../entities/enums';
import { QueueService } from '@/modules/queues/services/queue.service';
import { MessagingGrpcClient } from '@/modules/grpc/clients/messaging.client';

const makeRepo = () => ({
	create: jest.fn((e) => e),
	save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? 'saved-id' })),
	find: jest.fn().mockResolvedValue([]),
	findOne: jest.fn(),
});

describe('SchedulerService — stack trace leak (Fix 2)', () => {
	let service: SchedulerService;
	let executionRepo: ReturnType<typeof makeRepo>;
	let jobRepo: ReturnType<typeof makeRepo>;

	const fakeJob = {
		id: 'job-1',
		name: 'test-job',
		targetService: 'unknown-service',
		targetMethod: 'noop',
		payload: {},
		priority: Priority.MEDIUM,
		maxRetries: 0,
		timeoutSeconds: 5,
		isActive: true,
		category: {},
	};

	beforeEach(async () => {
		jobRepo = makeRepo();
		executionRepo = makeRepo();

		jobRepo.findOne.mockResolvedValue(fakeJob);
		executionRepo.save.mockImplementation((e: any) => Promise.resolve({ ...e }));

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SchedulerService,
				{ provide: getRepositoryToken(Job), useValue: jobRepo },
				{ provide: getRepositoryToken(Schedule), useValue: makeRepo() },
				{ provide: getRepositoryToken(Execution), useValue: executionRepo },
				{ provide: getRepositoryToken(JobCategory), useValue: makeRepo() },
				{ provide: getRepositoryToken(ExecutionLog), useValue: makeRepo() },
				{ provide: getRepositoryToken(RecurringJob), useValue: makeRepo() },
				{ provide: getRepositoryToken(JobDependency), useValue: makeRepo() },
				{
					provide: QueueService,
					useValue: { addJob: jest.fn(), addRepeatableJob: jest.fn(), removeJob: jest.fn() },
				},
				{
					provide: MessagingGrpcClient,
					useValue: { sendScheduledMessage: jest.fn(), cleanupExpiredMessages: jest.fn() },
				},
			],
		}).compile();

		service = module.get<SchedulerService>(SchedulerService);
	});

	it('errorData ne contient pas de champ "stack" apres une execution echouee', async () => {
		// Force un echec : le save de l'execution capture errorData apres l'echec.
		const capturedSaves: any[] = [];
		executionRepo.save.mockImplementation((e: any) => {
			capturedSaves.push({ ...e });
			return Promise.resolve({ ...e });
		});

		await service.executeJob('job-1');

		// Cherche parmi tous les saves celui qui porte errorData (l'echec ou le succes).
		const savesWithError = capturedSaves.filter((s) => s.errorData != null);
		// Si au moins un save a errorData, verifier l'absence de stack.
		savesWithError.forEach((s) => {
			expect(s.errorData).not.toHaveProperty('stack');
			expect(s.errorData).toHaveProperty('error');
			expect(Object.prototype.hasOwnProperty.call(s.errorData, 'code')).toBe(true);
		});
	});

	it('en cas de succes simulated, resultData ne contient pas de stack', async () => {
		const result = await service.executeJob('job-1');

		expect(result.status).toBe(ExecutionStatus.COMPLETED);
		expect(result.errorData).toBeUndefined();
		expect(result.resultData).toBeDefined();
		expect(result.resultData).not.toHaveProperty('stack');
	});
});
