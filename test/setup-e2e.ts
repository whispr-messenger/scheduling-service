/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';

// E2E test setup
beforeAll(async () => {
  // Set test environment variables for E2E tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/whispr_scheduling_test';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.REDIS_DB = '2'; // Different DB for E2E tests
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
