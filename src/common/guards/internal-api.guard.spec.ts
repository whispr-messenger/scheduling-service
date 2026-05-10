import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalApiGuard } from './internal-api.guard';

const makeContext = (headers: Record<string, string | undefined>): ExecutionContext =>
	({
		switchToHttp: () => ({
			getRequest: () => ({
				headers,
				path: '/api/v1/jobs',
				ip: '127.0.0.1',
			}),
		}),
	}) as unknown as ExecutionContext;

describe('InternalApiGuard', () => {
	const SECRET = 'super-secret-token';

	function buildGuard(token: string | undefined): InternalApiGuard {
		const configService = { get: jest.fn().mockReturnValue(token) } as unknown as ConfigService;
		return new InternalApiGuard(configService);
	}

	it('autorise si le header x-internal-token correspond au secret', () => {
		const guard = buildGuard(SECRET);
		expect(guard.canActivate(makeContext({ 'x-internal-token': SECRET }))).toBe(true);
	});

	it('refuse si le header est absent', () => {
		const guard = buildGuard(SECRET);
		expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
	});

	it('refuse si le header est incorrect', () => {
		const guard = buildGuard(SECRET);
		expect(() => guard.canActivate(makeContext({ 'x-internal-token': 'wrong' }))).toThrow(
			UnauthorizedException
		);
	});

	it('refuse si INTERNAL_API_TOKEN n est pas configure', () => {
		const guard = buildGuard(undefined);
		expect(() => guard.canActivate(makeContext({ 'x-internal-token': 'anything' }))).toThrow(
			UnauthorizedException
		);
	});
});
