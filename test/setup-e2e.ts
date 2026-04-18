/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

jest.mock('@nest-lab/throttler-storage-redis', () => {
	const ThrottlerStorageRedisService = jest.fn().mockImplementation(() => ({
		increment: jest.fn().mockResolvedValue({
			totalHits: 1,
			timeToExpire: 60000,
			isBlocked: false,
			timeToBlockExpire: 0,
		}),
		onModuleDestroy: jest.fn(),
	}));
	return { ThrottlerStorageRedisService };
});

// E2E test setup
beforeAll(async () => {
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
	process.env.GRPC_PORT = process.env.GRPC_PORT || '50053';

	// Database — use env vars if provided, otherwise fall back to k3d dev defaults
	process.env.DB_HOST = process.env.DB_HOST || 'localhost';
	process.env.DB_PORT = process.env.DB_PORT || '5432';
	process.env.DB_USERNAME = process.env.DB_USERNAME || 'whispr';
	process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'whispr_dev_password'; // NOSONAR - test environment default, not a real credential
	process.env.DB_NAME = process.env.DB_NAME || 'scheduling_service_db';
	process.env.DB_SYNCHRONIZE = process.env.DB_SYNCHRONIZE || 'false';
	process.env.DB_MIGRATIONS_RUN = process.env.DB_MIGRATIONS_RUN || 'false';

	// Redis
	process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
	process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
	process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'whispr_dev_password'; // NOSONAR - test environment default, not a real credential
	process.env.REDIS_DB = process.env.REDIS_DB || '4';
});

// Global E2E teardown
afterAll(async () => {
	console.log('E2E tests completed');
});

// Increase timeout for E2E tests
jest.setTimeout(60000);
