/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AppModule } from '../src/modules/app/app.module';
import { JobType, JobStatus, JobPriority } from '../src/modules/scheduler/enums';
import { CreateJobDto } from '../src/modules/scheduler/dto/create-job.dto';
import { CreateScheduleDto } from '../src/modules/scheduler/dto/create-schedule.dto';

describe('SchedulingService (e2e)', () => {
	let app: INestApplication;
	const createdJobIds: string[] = [];

	beforeAll(async () => {
		// Use AppModule directly which already contains TypeORM and Bull configuration
		// The setup-e2e.ts file configures environment variables for PostgreSQL
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		// Clean up created jobs
		for (const jobId of createdJobIds) {
			try {
				await request(app.getHttpServer()).delete(`/scheduler/jobs/${jobId}`);
			} catch (error) {
				// Ignore cleanup errors
			}
		}

		await app.close();
	});

	describe('/scheduler/jobs (POST)', () => {
		it('should create a new job', async () => {
			const createJobDto: CreateJobDto = {
				name: 'test-job-e2e',
				type: JobType.MESSAGE_DELIVERY,
				payload: {
					messageId: '123e4567-e89b-12d3-a456-426614174000',
					recipients: ['user1', 'user2'],
					content: 'Test message',
				},
				priority: 1,
				maxRetries: 3,
				metadata: {
					source: 'e2e-test',
					environment: 'test',
				},
			};

			const response = await request(app.getHttpServer())
				.post('/scheduler/jobs')
				.send(createJobDto)
				.expect(201);

			expect(response.body).toMatchObject({
				name: createJobDto.name,
				type: createJobDto.type,
				payload: createJobDto.payload,
				priority: createJobDto.priority,
				maxRetries: createJobDto.maxRetries,
				metadata: createJobDto.metadata,
				status: JobStatus.PENDING,
				retryCount: 0,
			});

			expect(response.body.id).toBeDefined();
			expect(response.body.createdAt).toBeDefined();
			expect(response.body.updatedAt).toBeDefined();

			createdJobIds.push(response.body.id);
		});

		it('should validate job creation input', async () => {
			const invalidJobDto = {
				name: '', // Invalid: empty name
				type: 'INVALID_TYPE', // Invalid: unknown type
				payload: null, // Invalid: null payload
			};

			await request(app.getHttpServer()).post('/scheduler/jobs').send(invalidJobDto).expect(400);
		});

		it('should create job with minimal required fields', async () => {
			const minimalJobDto: CreateJobDto = {
				name: 'minimal-job',
				type: JobType.CLEANUP,
				payload: { action: 'clean_temp_files' },
			};

			const response = await request(app.getHttpServer())
				.post('/scheduler/jobs')
				.send(minimalJobDto)
				.expect(201);

			expect(response.body.name).toBe(minimalJobDto.name);
			expect(response.body.type).toBe(minimalJobDto.type);
			expect(response.body.payload).toEqual(minimalJobDto.payload);
			expect(response.body.priority).toBe(1); // Default priority
			expect(response.body.maxRetries).toBe(3); // Default retries

			createdJobIds.push(response.body.id);
		});
	});

	describe('/scheduler/jobs/:id (GET)', () => {
		let testJobId: string;

		beforeAll(async () => {
			// Create a test job
			const createJobDto: CreateJobDto = {
				name: 'get-test-job',
				type: JobType.NOTIFICATION,
				payload: { notification: 'test' },
			};

			const response = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			testJobId = response.body.id;
			createdJobIds.push(testJobId);
		});

		it('should get job by ID', async () => {
			const response = await request(app.getHttpServer())
				.get(`/scheduler/jobs/${testJobId}`)
				.expect(200);

			expect(response.body.id).toBe(testJobId);
			expect(response.body.name).toBe('get-test-job');
			expect(response.body.type).toBe(JobType.NOTIFICATION);
		});

		it('should return 404 for non-existent job', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';

			await request(app.getHttpServer()).get(`/scheduler/jobs/${fakeId}`).expect(404);
		});

		it('should return 400 for invalid UUID', async () => {
			await request(app.getHttpServer()).get('/scheduler/jobs/invalid-uuid').expect(400);
		});
	});

	describe('/scheduler/jobs (GET)', () => {
		beforeAll(async () => {
			// Create multiple test jobs
			const jobTypes = [JobType.MESSAGE_DELIVERY, JobType.NOTIFICATION, JobType.CLEANUP];

			for (let i = 0; i < 5; i++) {
				const createJobDto: CreateJobDto = {
					name: `list-test-job-${i}`,
					type: jobTypes[i % jobTypes.length],
					payload: { index: i },
					priority: i + 1,
				};

				const response = await request(app.getHttpServer())
					.post('/scheduler/jobs')
					.send(createJobDto);

				createdJobIds.push(response.body.id);
			}
		});

		it('should get all jobs with pagination', async () => {
			const response = await request(app.getHttpServer())
				.get('/scheduler/jobs?limit=3&offset=0')
				.expect(200);

			expect(response.body.jobs).toHaveLength(3);
			expect(response.body.total).toBeGreaterThanOrEqual(3);
			expect(response.body.limit).toBe(3);
			expect(response.body.offset).toBe(0);
		});

		it('should filter jobs by status', async () => {
			const response = await request(app.getHttpServer())
				.get(`/scheduler/jobs?status=${JobStatus.PENDING}`)
				.expect(200);

			expect(response.body.jobs).toBeDefined();
			response.body.jobs.forEach((job: any) => {
				expect(job.status).toBe(JobStatus.PENDING);
			});
		});

		it('should filter jobs by type', async () => {
			const response = await request(app.getHttpServer())
				.get(`/scheduler/jobs?type=${JobType.NOTIFICATION}`)
				.expect(200);

			expect(response.body.jobs).toBeDefined();
			response.body.jobs.forEach((job: any) => {
				expect(job.type).toBe(JobType.NOTIFICATION);
			});
		});
	});

	describe('/scheduler/jobs/:id (PUT)', () => {
		let testJobId: string;

		beforeAll(async () => {
			const createJobDto: CreateJobDto = {
				name: 'update-test-job',
				type: JobType.MESSAGE_DELIVERY,
				payload: { original: 'data' },
				priority: 1,
			};

			const response = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			testJobId = response.body.id;
			createdJobIds.push(testJobId);
		});

		it('should update job', async () => {
			const updateJobDto = {
				name: 'updated-test-job',
				priority: 5,
				metadata: { updated: true, version: 2 },
			};

			const response = await request(app.getHttpServer())
				.put(`/scheduler/jobs/${testJobId}`)
				.send(updateJobDto)
				.expect(200);

			expect(response.body.name).toBe(updateJobDto.name);
			expect(response.body.priority).toBe(updateJobDto.priority);
			expect(response.body.metadata).toEqual(updateJobDto.metadata);
			expect(response.body.updatedAt).not.toBe(response.body.createdAt);
		});

		it('should return 404 for non-existent job update', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';
			const updateJobDto = { name: 'updated-name' };

			await request(app.getHttpServer())
				.put(`/scheduler/jobs/${fakeId}`)
				.send(updateJobDto)
				.expect(404);
		});
	});

	describe('/scheduler/jobs/:id/schedule (POST)', () => {
		it('should schedule job with cron expression', async () => {
			// Create a new job for this test
			const createJobDto: CreateJobDto = {
				name: 'schedule-test-job-1',
				type: JobType.CLEANUP,
				payload: { action: 'daily_cleanup' },
			};

			const jobResponse = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			const testJobId = jobResponse.body.id;
			createdJobIds.push(testJobId);

			const scheduleDto: CreateScheduleDto = {
				cronExpression: '0 2 * * *', // Daily at 2 AM
				timezone: 'UTC',
				isActive: true,
				metadata: { description: 'Daily cleanup schedule' },
			};

			const response = await request(app.getHttpServer())
				.post(`/scheduler/jobs/${testJobId}/schedule`)
				.send(scheduleDto)
				.expect(201);

			expect(response.body.jobId).toBe(testJobId);
			expect(response.body.cronExpression).toBe(scheduleDto.cronExpression);
			expect(response.body.timezone).toBe(scheduleDto.timezone);
			expect(response.body.isActive).toBe(true);
		});

		it('should validate cron expression', async () => {
			// Create a new job for this test
			const createJobDto: CreateJobDto = {
				name: 'schedule-test-job-2',
				type: JobType.CLEANUP,
				payload: { action: 'validate_cron' },
			};

			const jobResponse = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			const testJobId = jobResponse.body.id;
			createdJobIds.push(testJobId);

			const invalidScheduleDto = {
				cronExpression: 'invalid-cron',
				timezone: 'UTC',
				isActive: true,
			};

			await request(app.getHttpServer())
				.post(`/scheduler/jobs/${testJobId}/schedule`)
				.send(invalidScheduleDto)
				.expect(400);
		});

		it('should schedule job with start and end dates', async () => {
			const now = new Date();
			const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
			const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

			const scheduleDto: CreateScheduleDto = {
				cronExpression: '0 12 * * *', // Daily at noon
				timezone: 'America/New_York',
				startAt: tomorrow,
				endAt: nextWeek,
				isActive: true,
			};

			// Create another job for this test
			const createJobResponse = await request(app.getHttpServer())
				.post('/scheduler/jobs')
				.send({
					name: 'schedule-with-dates-job',
					type: JobType.NOTIFICATION,
					payload: { reminder: 'lunch' },
				});

			const newJobId = createJobResponse.body.id;
			createdJobIds.push(newJobId);

			const response = await request(app.getHttpServer())
				.post(`/scheduler/jobs/${newJobId}/schedule`)
				.send(scheduleDto)
				.expect(201);

			expect(new Date(response.body.startAt)).toEqual(tomorrow);
			expect(new Date(response.body.endAt)).toEqual(nextWeek);
			expect(response.body.timezone).toBe('America/New_York');
		});
	});

	describe('/scheduler/jobs/:id/execute (POST)', () => {
		let testJobId: string;

		beforeAll(async () => {
			const createJobDto: CreateJobDto = {
				name: 'execute-test-job',
				type: JobType.MESSAGE_DELIVERY,
				payload: { messageId: 'msg-123', recipient: 'user-456' },
			};

			const response = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			testJobId = response.body.id;
			createdJobIds.push(testJobId);
		});

		it('should execute job immediately', async () => {
			const response = await request(app.getHttpServer())
				.post(`/scheduler/jobs/${testJobId}/execute`)
				.expect(201);

			expect(response.body.jobId).toBe(testJobId);
			expect(response.body.status).toBeDefined();
			expect(response.body.startedAt).toBeDefined();
		});

		it('should return 404 for non-existent job execution', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';

			await request(app.getHttpServer()).post(`/scheduler/jobs/${fakeId}/execute`).expect(404);
		});
	});

	describe('/scheduler/jobs/:id (DELETE)', () => {
		let testJobId: string;

		beforeAll(async () => {
			const createJobDto: CreateJobDto = {
				name: 'delete-test-job',
				type: JobType.CLEANUP,
				payload: { target: 'temp_files' },
			};

			const response = await request(app.getHttpServer()).post('/scheduler/jobs').send(createJobDto);

			testJobId = response.body.id;
		});

		it('should delete job', async () => {
			await request(app.getHttpServer()).delete(`/scheduler/jobs/${testJobId}`).expect(200);

			// Verify job is deleted
			await request(app.getHttpServer()).get(`/scheduler/jobs/${testJobId}`).expect(404);
		});

		it('should return 404 for non-existent job deletion', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';

			await request(app.getHttpServer()).delete(`/scheduler/jobs/${fakeId}`).expect(404);
		});
	});

	describe('/scheduler/statistics (GET)', () => {
		it('should get job statistics', async () => {
			const response = await request(app.getHttpServer()).get('/scheduler/statistics').expect(200);

			expect(response.body).toMatchObject({
				[JobStatus.PENDING]: expect.any(Number),
				[JobStatus.RUNNING]: expect.any(Number),
				[JobStatus.COMPLETED]: expect.any(Number),
				[JobStatus.FAILED]: expect.any(Number),
				[JobStatus.PAUSED]: expect.any(Number),
				[JobStatus.CANCELLED]: expect.any(Number),
			});
		});
	});

	describe('/queues/stats (GET)', () => {
		it('should get queue statistics', async () => {
			const response = await request(app.getHttpServer()).get('/queues/stats').expect(200);

			expect(response.body).toHaveProperty('scheduler');
			expect(response.body).toHaveProperty('priority');
			expect(response.body).toHaveProperty('delayed');
			expect(response.body).toHaveProperty('total');

			expect(response.body.total).toMatchObject({
				waiting: expect.any(Number),
				active: expect.any(Number),
				completed: expect.any(Number),
				failed: expect.any(Number),
				delayed: expect.any(Number),
				paused: expect.any(Number),
			});
		});
	});

	describe('/health (GET)', () => {
		it('should return health status', async () => {
			const response = await request(app.getHttpServer()).get('/health').expect(200);

			expect(response.body).toHaveProperty('status');
			expect(response.body.status).toBe('ok');
		});
	});

	describe('Job lifecycle integration', () => {
		it('should handle complete job lifecycle', async () => {
			// 1. Create job
			const createJobDto: CreateJobDto = {
				name: 'lifecycle-test-job',
				type: JobType.MESSAGE_DELIVERY,
				payload: {
					messageId: 'lifecycle-msg-123',
					recipient: 'lifecycle-user-456',
				},
				priority: 2,
				metadata: { test: 'lifecycle' },
			};

			const createResponse = await request(app.getHttpServer())
				.post('/scheduler/jobs')
				.send(createJobDto)
				.expect(201);

			const jobId = createResponse.body.id;
			createdJobIds.push(jobId);

			// 2. Schedule job
			const scheduleDto: CreateScheduleDto = {
				cronExpression: '*/5 * * * * *', // Every 5 seconds
				timezone: 'UTC',
				isActive: true,
			};

			await request(app.getHttpServer())
				.post(`/scheduler/jobs/${jobId}/schedule`)
				.send(scheduleDto)
				.expect(201);

			// 3. Execute job
			const executeResponse = await request(app.getHttpServer())
				.post(`/scheduler/jobs/${jobId}/execute`)
				.expect(201);

			expect(executeResponse.body.jobId).toBe(jobId);

			// 4. Get job executions
			const executionsResponse = await request(app.getHttpServer())
				.get(`/scheduler/jobs/${jobId}/executions`)
				.expect(200);

			expect(executionsResponse.body).toHaveLength(1);
			expect(executionsResponse.body[0].jobId).toBe(jobId);

			// 5. Update job
			const updateDto = {
				metadata: { test: 'lifecycle', updated: true },
			};

			const updateResponse = await request(app.getHttpServer())
				.put(`/scheduler/jobs/${jobId}`)
				.send(updateDto)
				.expect(200);

			expect(updateResponse.body.metadata.updated).toBe(true);

			// 6. Pause job
			await request(app.getHttpServer()).post(`/scheduler/jobs/${jobId}/pause`).expect(200);

			// 7. Resume job
			await request(app.getHttpServer()).post(`/scheduler/jobs/${jobId}/resume`).expect(200);
		});
	});
});
