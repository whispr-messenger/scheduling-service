import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

const SHUTDOWN_TIMEOUT_MS = 5_000;

@Injectable()
export class CacheShutdownService implements OnModuleDestroy {
	private readonly logger = new Logger(CacheShutdownService.name);

	constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

	async onModuleDestroy(): Promise<void> {
		this.logger.log('Closing Redis cache connection…');

		let timer: ReturnType<typeof setTimeout> | undefined;

		try {
			await Promise.race([
				this.cacheManager.disconnect(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('Cache disconnect timed out')),
						SHUTDOWN_TIMEOUT_MS
					);
				}),
			]);
			this.logger.log('Redis cache connection closed');
		} catch (error) {
			this.logger.warn(`Failed to close Redis cache connection: ${(error as Error).message}`);
		} finally {
			clearTimeout(timer);
		}
	}
}
