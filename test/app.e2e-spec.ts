import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app/app.module';

describe('SchedulingService (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('/health (GET)', () => {
		it('should return health status', async () => {
			const response = await request(app.getHttpServer()).get('/health').expect(200);

			expect(response.body).toHaveProperty('status');
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('uptime');
			expect(response.body).toHaveProperty('services');
			expect(response.body.services).toHaveProperty('database');
			expect(response.body.services).toHaveProperty('cache');
		});

		it('should return liveness check', async () => {
			const response = await request(app.getHttpServer()).get('/health/live').expect(200);

			expect(response.body).toHaveProperty('status', 'alive');
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('uptime');
		});

		it('should return readiness check', async () => {
			const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

			expect(response.body).toHaveProperty('status');
		});
	});

	describe('/api/v1/jobs (POST) — requires auth', () => {
		it('should return 401 without authorization header', async () => {
			await request(app.getHttpServer())
				.post('/api/v1/jobs')
				.send({ name: '', payload: null })
				.expect(401);
		});
	});

	describe('/api/v1/jobs/:jobId (GET) — requires auth', () => {
		it('should return 401 without authorization header', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';
			await request(app.getHttpServer()).get(`/api/v1/jobs/${fakeId}`).expect(401);
		});
	});

	describe('/api/v1/jobs/:jobId/execute (POST) — requires auth', () => {
		it('should return 401 without authorization header', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';
			await request(app.getHttpServer()).post(`/api/v1/jobs/${fakeId}/execute`).expect(401);
		});
	});
});
