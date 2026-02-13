/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

// E2E test setup
beforeAll(async () => {
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
	process.env.GRPC_PORT = process.env.GRPC_PORT || '50053';
});

// Global E2E teardown
afterAll(async () => {
	console.log('E2E tests completed');
});

// Increase timeout for E2E tests
jest.setTimeout(60000);
