/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

// Global test setup
beforeAll(async () => {
	// Set test environment variables
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'sqlite::memory:';
	process.env.REDIS_HOST = 'localhost';
	process.env.REDIS_PORT = '6379';
	process.env.REDIS_DB = '1';
});

// Global test teardown
afterAll(async () => {
	// Cleanup after all tests
});

// Mock external dependencies
jest.mock('@nestjs/bull', () => ({
	BullModule: {
		forRoot: jest.fn().mockReturnValue({
			module: class MockBullModule {},
		}),
		registerQueue: jest.fn().mockReturnValue({
			module: class MockQueueModule {},
		}),
	},
	getQueueToken: jest.fn((name: string) => `BullQueue_${name}`),
	Process: jest.fn(),
	Processor: jest.fn(),
	OnQueueActive: jest.fn(),
	OnQueueCompleted: jest.fn(),
	OnQueueFailed: jest.fn(),
}));

// Mock Redis
jest.mock('ioredis', () => {
	return jest.fn().mockImplementation(() => ({
		on: jest.fn(),
		connect: jest.fn(),
		disconnect: jest.fn(),
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		exists: jest.fn(),
		flushdb: jest.fn(),
	}));
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled Rejection:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);
