/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

// E2E test setup
beforeAll(async () => {
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
	process.env.GRPC_PORT = process.env.GRPC_PORT || '50053';

	// Database — use env vars if provided, otherwise fall back to k3d dev defaults
	process.env.DB_DISABLE = 'true';

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
