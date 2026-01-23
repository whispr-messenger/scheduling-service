import runEnvChecks from './check-env';

describe('Environment Checks', () => {
	let consoleLogSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let consoleWarnSpy: jest.SpyInstance;
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Setup spies
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;

		// Restore console methods
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	describe('All required variables present', () => {
		beforeEach(() => {
			// Set all required environment variables
			process.env.NODE_ENV = 'production';
			process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';
		});

		it('should pass when all required variables are set', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('All required environment variables are set')
			);
		});

		it('should check all required variables', () => {
			runEnvChecks();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('NODE_ENV is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_HOST is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PORT is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP_PORT is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('GRPC_PORT is set'));
		});
	});

	describe('Missing required variables', () => {
		it('should throw when NODE_ENV is missing', () => {
			process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';
			// NODE_ENV not set

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should throw when DATABASE_URL is missing', () => {
			process.env.NODE_ENV = 'production';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';
			// DATABASE_URL not set

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('DATABASE_URL is NOT set (REQUIRED)')
			);
		});

		it('should throw when multiple variables are missing', () => {
			process.env.NODE_ENV = 'production';
			// All other required variables missing

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('required environment variable(s) missing'));
		});
	});

	describe('Empty string values', () => {
		it('should treat empty strings as missing', () => {
			process.env.NODE_ENV = '';
			process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should treat whitespace-only strings as missing', () => {
			process.env.NODE_ENV = '   ';
			process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');
		});
	});

	describe('Optional variables', () => {
		beforeEach(() => {
			// Set all required variables
			process.env.NODE_ENV = 'production';
			process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
			process.env.REDIS_HOST = 'localhost';
			process.env.REDIS_PORT = '6379';
			process.env.HTTP_PORT = '3000';
			process.env.GRPC_PORT = '50051';
			process.env.MESSAGING_SERVICE_HOST = 'localhost';
			process.env.MESSAGING_SERVICE_PORT = '50052';
			process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
			process.env.NOTIFICATION_SERVICE_PORT = '50053';
		});

		it('should warn when optional variables are missing', () => {
			runEnvChecks();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});

		it('should not throw when optional variables are missing', () => {
			expect(() => runEnvChecks()).not.toThrow();
		});

		it('should not warn when optional variables are set', () => {
			process.env.REDIS_PASSWORD = 'secret';
			process.env.LOG_LEVEL = 'debug';
			process.env.METRICS_ENABLED = 'true';
			process.env.BULL_BOARD_ENABLED = 'true';
			process.env.SWAGGER_ENABLED = 'true';
			process.env.REDIS_DB = '1';
			process.env.NODE_OPTIONS = '--max-old-space-size=4096';
			process.env.HEALTH_CHECK_TIMEOUT = '10000';

			runEnvChecks();

			expect(consoleWarnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});
	});
});
