/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

// E2E test setup
beforeAll(async () => {
	// Set test environment variables for E2E tests
	process.env.NODE_ENV = 'test';

	// Use environment variables if set (for CI), otherwise use defaults (for local dev)
	process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
	process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
	process.env.DATABASE_USERNAME = process.env.DATABASE_USERNAME || 'whisper_user';
	process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'whisper_password';
	process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'whispr_scheduling_dev';
	process.env.DATABASE_SSL = process.env.DATABASE_SSL || 'false';

	process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
	process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
	process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'redis_password';
	process.env.REDIS_DB = process.env.REDIS_DB || '0';

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.GRPC_PORT = '50053'; // Different port for tests
});

// Global E2E teardown
afterAll(async () => {
	// Cleanup after all E2E tests
	console.log('E2E tests completed');
});

// Increase timeout for E2E tests
jest.setTimeout(60000);
