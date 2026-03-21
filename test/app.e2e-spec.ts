import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app/app.module';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

class MockAuthGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest();
		req.user = { userId: 'test-user', jti: 'test-jti', deviceId: 'test-device' };
		return true;
	}
}

describe('SchedulingService (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideGuard(JwtAuthGuard)
			.useClass(MockAuthGuard)
			.overrideGuard(ThrottlerGuard)
			.useValue({ canActivate: () => true })
			.compile();

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

	describe('/api/v1/jobs (POST)', () => {
		it('should return 400 for invalid job creation input', async () => {
			const invalidJobDto = {
				name: '',
				payload: null,
			};

			await request(app.getHttpServer()).post('/api/v1/jobs').send(invalidJobDto).expect(400);
		});

		it('should return 400 for missing required fields', async () => {
			await request(app.getHttpServer()).post('/api/v1/jobs').send({}).expect(400);
		});
	});

	describe('/api/v1/jobs/:jobId (GET)', () => {
		it('should return 404 for non-existent job', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';

			await request(app.getHttpServer()).get(`/api/v1/jobs/${fakeId}`).expect(404);
		});

		it('should return 400 for invalid UUID', async () => {
			await request(app.getHttpServer()).get('/api/v1/jobs/invalid-uuid').expect(400);
		});
	});

	describe('/api/v1/jobs/:jobId/execute (POST)', () => {
		it('should return 404 for non-existent job execution', async () => {
			const fakeId = '123e4567-e89b-12d3-a456-426614174999';

			await request(app.getHttpServer()).post(`/api/v1/jobs/${fakeId}/execute`).expect(404);
		});
	});
});
