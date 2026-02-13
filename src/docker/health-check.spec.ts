/**
 * @jest-environment node
 */

import * as http from 'http';

describe('Health Check Script', () => {
	let consoleLogSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let processExitSpy: jest.SpyInstance;
	let httpRequestSpy: jest.SpyInstance;
	let mockRequest: any;

	beforeEach(() => {
		// Setup spies
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
			throw new Error(`process.exit(${code})`);
		});

		// Setup mock request
		mockRequest = {
			on: jest.fn().mockReturnThis(),
			end: jest.fn(),
			destroy: jest.fn(),
		};

		httpRequestSpy = jest.spyOn(http, 'request').mockReturnValue(mockRequest as any);

		// Clear mocks
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Restore spies
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
		httpRequestSpy.mockRestore();
	});

	describe('Successful health check', () => {
		it('should exit with code 0 when health check returns 200', () => {
			const mockResponse = {
				statusCode: 200,
				on: jest.fn(),
			};

			mockResponse.on.mockImplementation((event: string, callback: Function) => {
				if (event === 'data') {
					callback('{"status":"ready"}');
				} else if (event === 'end') {
					callback();
				}
				return mockResponse;
			});

			httpRequestSpy.mockImplementation((options: any, callback: Function) => {
				callback(mockResponse);
				return mockRequest;
			});

			// Re-require the module to trigger execution
			jest.isolateModules(() => {
				expect(() => {
					require('./health-check');
				}).toThrow('process.exit(0)');
			});

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('Health check PASSED')
			);
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});
	});

	describe('Failed health check', () => {
		it('should exit with code 1 when health check returns non-200 status', () => {
			const mockResponse = {
				statusCode: 503,
				on: jest.fn(),
			};

			mockResponse.on.mockImplementation((event: string, callback: Function) => {
				if (event === 'data') {
					callback('{"status":"not ready"}');
				} else if (event === 'end') {
					callback();
				}
				return mockResponse;
			});

			httpRequestSpy.mockImplementation((options: any, callback: Function) => {
				callback(mockResponse);
				return mockRequest;
			});

			jest.isolateModules(() => {
				expect(() => {
					require('./health-check');
				}).toThrow('process.exit(1)');
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Health check FAILED')
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it('should exit with code 1 when request has an error', () => {
			const mockError = new Error('Connection refused');

			mockRequest.on.mockImplementation((event: string, callback: Function) => {
				if (event === 'error') {
					callback(mockError);
				}
				return mockRequest;
			});

			jest.isolateModules(() => {
				expect(() => {
					require('./health-check');
				}).toThrow('process.exit(1)');
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Health check FAILED: Request error')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Connection refused')
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it('should exit with code 1 when request times out', () => {
			mockRequest.on.mockImplementation((event: string, callback: Function) => {
				if (event === 'timeout') {
					callback();
				}
				return mockRequest;
			});

			jest.isolateModules(() => {
				expect(() => {
					require('./health-check');
				}).toThrow('process.exit(1)');
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Health check FAILED: Request timeout')
			);
			expect(mockRequest.destroy).toHaveBeenCalled();
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});
	});

	describe('Configuration', () => {
		it('should use correct endpoint path', () => {
			const mockResponse = {
				statusCode: 200,
				on: jest.fn().mockImplementation((event: string, callback: Function) => {
					if (event === 'end') callback();
					return mockResponse;
				}),
			};

			httpRequestSpy.mockImplementation((options: any, callback: Function) => {
				expect(options.path).toBe('/api/v1/monitoring/health/ready');
				callback(mockResponse);
				return mockRequest;
			});

			jest.isolateModules(() => {
				try {
					require('./health-check');
				} catch (_e) {
					// Ignore exit error
				}
			});
		});

		it('should use HTTP_PORT environment variable if set', () => {
			process.env.HTTP_PORT = '4000';

			const mockResponse = {
				statusCode: 200,
				on: jest.fn().mockImplementation((event: string, callback: Function) => {
					if (event === 'end') callback();
					return mockResponse;
				}),
			};

			httpRequestSpy.mockImplementation((options: any, callback: Function) => {
				expect(options.port).toBe(4000);
				callback(mockResponse);
				return mockRequest;
			});

			jest.isolateModules(() => {
				try {
					require('./health-check');
				} catch (_e) {
					// Ignore exit error
				}
			});

			delete process.env.HTTP_PORT;
		});

		it('should default to port 3000 if HTTP_PORT not set', () => {
			delete process.env.HTTP_PORT;

			const mockResponse = {
				statusCode: 200,
				on: jest.fn().mockImplementation((event: string, callback: Function) => {
					if (event === 'end') callback();
					return mockResponse;
				}),
			};

			httpRequestSpy.mockImplementation((options: any, callback: Function) => {
				expect(options.port).toBe(3000);
				callback(mockResponse);
				return mockRequest;
			});

			jest.isolateModules(() => {
				try {
					require('./health-check');
				} catch (_e) {
					// Ignore exit error
				}
			});
		});
	});
});
