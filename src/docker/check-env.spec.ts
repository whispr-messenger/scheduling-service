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

		// Re-import to reset module-level counters
		jest.resetModules();
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;

		// Restore console methods
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	function setAllRequiredVars(): void {
		process.env.NODE_ENV = 'production';
		process.env.DB_HOST = 'localhost';
		process.env.DB_PORT = '5432';
		process.env.DB_USERNAME = 'user';
		process.env.DB_PASSWORD = 'pass';
		process.env.DB_NAME = 'db';
		process.env.REDIS_HOST = 'localhost';
		process.env.REDIS_PORT = '6379';
		process.env.HTTP_PORT = '3000';
		process.env.GRPC_PORT = '50051';
		process.env.MESSAGING_SERVICE_HOST = 'localhost';
		process.env.MESSAGING_SERVICE_PORT = '50052';
		process.env.NOTIFICATION_SERVICE_HOST = 'localhost';
		process.env.NOTIFICATION_SERVICE_PORT = '50053';
	}

	async function freshRunEnvChecks(): Promise<typeof runEnvChecks> {
		const mod = await import('./check-env');
		return mod.default;
	}

	describe('All required variables present', () => {
		it('should pass when all required variables are set', async () => {
			setAllRequiredVars();
			const run = await freshRunEnvChecks();

			expect(() => run()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('All required environment variables are set')
			);
		});

		it('should check all required variables', async () => {
			setAllRequiredVars();
			const run = await freshRunEnvChecks();

			run();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('NODE_ENV is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DB_HOST is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PORT is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DB_USERNAME is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_HOST is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PORT is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('One of [PORT, HTTP_PORT] is set')
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('GRPC_PORT is set'));
		});

		it('should pass when only PORT is set and HTTP_PORT is missing', async () => {
			setAllRequiredVars();
			delete process.env.HTTP_PORT;
			process.env.PORT = '3000';
			const run = await freshRunEnvChecks();

			expect(() => run()).not.toThrow();
		});
	});

	describe('Missing required variables', () => {
		it('should throw when NODE_ENV is missing', async () => {
			setAllRequiredVars();
			delete process.env.NODE_ENV;
			const run = await freshRunEnvChecks();

			expect(() => run()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should throw when DB_HOST is missing', async () => {
			setAllRequiredVars();
			delete process.env.DB_HOST;
			const run = await freshRunEnvChecks();

			expect(() => run()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('DB_HOST is NOT set (REQUIRED)')
			);
		});

		it('should throw when multiple variables are missing', async () => {
			process.env.NODE_ENV = 'production';
			// All other required variables missing
			const run = await freshRunEnvChecks();

			expect(() => run()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('required environment variable(s) missing')
			);
		});
	});

	describe('Empty string values', () => {
		it('should treat empty strings as missing', async () => {
			setAllRequiredVars();
			process.env.NODE_ENV = '';
			const run = await freshRunEnvChecks();

			expect(() => run()).toThrow('Missing required environment variables');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should treat whitespace-only strings as missing', async () => {
			setAllRequiredVars();
			process.env.NODE_ENV = '   ';
			const run = await freshRunEnvChecks();

			expect(() => run()).toThrow('Missing required environment variables');
		});
	});

	describe('Optional variables', () => {
		it('should warn when optional variables are missing', async () => {
			setAllRequiredVars();
			const run = await freshRunEnvChecks();

			run();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});

		it('should not throw when optional variables are missing', async () => {
			setAllRequiredVars();
			const run = await freshRunEnvChecks();

			expect(() => run()).not.toThrow();
		});

		it('should not warn when optional variables are set', async () => {
			setAllRequiredVars();
			process.env.REDIS_PASSWORD = 'secret';
			process.env.LOG_LEVEL = 'debug';
			process.env.METRICS_ENABLED = 'true';
			process.env.BULL_BOARD_ENABLED = 'true';
			process.env.SWAGGER_ENABLED = 'true';
			process.env.REDIS_DB = '1';
			process.env.NODE_OPTIONS = '--max-old-space-size=4096';
			process.env.HEALTH_CHECK_TIMEOUT = '10000';
			const run = await freshRunEnvChecks();

			run();

			expect(consoleWarnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});
	});
});
