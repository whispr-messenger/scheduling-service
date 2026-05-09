import 'reflect-metadata';

// le setup global mock @nestjs/bullmq pour les autres specs.
// ici on veut le vrai pour pouvoir lire les metadata posees par les decorateurs.
jest.unmock('@nestjs/bullmq');

const PROCESSOR_METADATA = 'bullmq:processor_metadata';
const WORKER_METADATA = 'bullmq:worker_metadata';

// helper: charge le module avec un BULL_CONCURRENCY donne
function loadProcessorsWithEnv(envValue: string | undefined): {
	HighPriorityJobProcessor: any;
	MediumPriorityJobProcessor: any;
	LowPriorityJobProcessor: any;
} {
	jest.resetModules();
	if (envValue === undefined) {
		delete process.env.BULL_CONCURRENCY;
	} else {
		process.env.BULL_CONCURRENCY = envValue;
	}
	// require est intentionnel ici pour contourner le cache de modules ESM

	return require('./job.processor');
}

describe('Job processors decorator metadata', () => {
	const ORIGINAL_ENV = process.env.BULL_CONCURRENCY;

	afterAll(() => {
		if (ORIGINAL_ENV === undefined) {
			delete process.env.BULL_CONCURRENCY;
		} else {
			process.env.BULL_CONCURRENCY = ORIGINAL_ENV;
		}
	});

	describe('default concurrency from env (BULL_CONCURRENCY unset -> 5)', () => {
		const { HighPriorityJobProcessor, MediumPriorityJobProcessor, LowPriorityJobProcessor } =
			loadProcessorsWithEnv(undefined);

		it.each([
			['HighPriorityJobProcessor', HighPriorityJobProcessor, 'high-priority'],
			['MediumPriorityJobProcessor', MediumPriorityJobProcessor, 'medium-priority'],
			['LowPriorityJobProcessor', LowPriorityJobProcessor, 'low-priority'],
		])('%s exposes queue name + concurrency 5 + maxStalledCount 5', (_name, ctor, expectedQueue) => {
			const processorMeta = Reflect.getMetadata(PROCESSOR_METADATA, ctor);
			const workerMeta = Reflect.getMetadata(WORKER_METADATA, ctor);

			expect(processorMeta).toEqual(expect.objectContaining({ name: expectedQueue }));
			expect(workerMeta).toEqual(expect.objectContaining({ concurrency: 5, maxStalledCount: 5 }));
		});
	});

	describe('concurrency override via BULL_CONCURRENCY env var', () => {
		it('reads BULL_CONCURRENCY=12 from env', () => {
			const { HighPriorityJobProcessor } = loadProcessorsWithEnv('12');
			const workerMeta = Reflect.getMetadata(WORKER_METADATA, HighPriorityJobProcessor);
			expect(workerMeta?.concurrency).toBe(12);
		});

		it('clamps invalid (NaN) BULL_CONCURRENCY to 1 minimum', () => {
			const { HighPriorityJobProcessor } = loadProcessorsWithEnv('not-a-number');
			const workerMeta = Reflect.getMetadata(WORKER_METADATA, HighPriorityJobProcessor);
			expect(workerMeta?.concurrency).toBe(1);
		});

		it('clamps zero/negative BULL_CONCURRENCY to 1 minimum', () => {
			const { LowPriorityJobProcessor } = loadProcessorsWithEnv('0');
			const workerMeta = Reflect.getMetadata(WORKER_METADATA, LowPriorityJobProcessor);
			expect(workerMeta?.concurrency).toBe(1);
		});
	});

	describe('maxStalledCount = 5 sur les trois processors (alignement avec attempts)', () => {
		it('chaque processor a maxStalledCount = 5', () => {
			const { HighPriorityJobProcessor, MediumPriorityJobProcessor, LowPriorityJobProcessor } =
				loadProcessorsWithEnv('5');

			for (const ctor of [
				HighPriorityJobProcessor,
				MediumPriorityJobProcessor,
				LowPriorityJobProcessor,
			]) {
				const workerMeta = Reflect.getMetadata(WORKER_METADATA, ctor);
				expect(workerMeta?.maxStalledCount).toBe(5);
			}
		});
	});
});
