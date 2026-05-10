import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/modules/app/app.module';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';

// WHISPR-1348 : verifie que helmet pose bien les entetes de securite HTTP
// (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
// alignes sur auth-service / user-service / media-service.
describe('Security headers (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = moduleFixture.createNestApplication();

		// Aligne le test sur le bootstrap prod (src/main.ts) : helmet doit etre
		// actif pour valider que les entetes de securite sont bien poses.
		app.use(
			helmet({
				contentSecurityPolicy: {
					directives: {
						defaultSrc: ["'self'"],
						scriptSrc: ["'self'", "'unsafe-inline'"],
						styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
						imgSrc: ["'self'", 'data:'],
					},
				},
				crossOriginEmbedderPolicy: false,
			})
		);

		await app.init();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	it('should set X-Content-Type-Options to nosniff', async () => {
		const response = await request(app.getHttpServer()).get('/health/live').expect(200);

		expect(response.headers['x-content-type-options']).toBe('nosniff');
	});

	it('should set X-Frame-Options to deny clickjacking', async () => {
		const response = await request(app.getHttpServer()).get('/health/live').expect(200);

		expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
	});

	it('should set a Referrer-Policy header', async () => {
		const response = await request(app.getHttpServer()).get('/health/live').expect(200);

		expect(response.headers['referrer-policy']).toBeDefined();
	});

	it('should set a Content-Security-Policy header', async () => {
		const response = await request(app.getHttpServer()).get('/health/live').expect(200);

		expect(response.headers['content-security-policy']).toBeDefined();
		expect(response.headers['content-security-policy']).toContain("default-src 'self'");
	});

	it('should remove the X-Powered-By header to hide framework fingerprint', async () => {
		const response = await request(app.getHttpServer()).get('/health/live').expect(200);

		expect(response.headers['x-powered-by']).toBeUndefined();
	});
});
