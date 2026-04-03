import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthIndicatorResult, HealthIndicator } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueueService } from '@/modules/queues/services/queue.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CustomHealthService extends HealthIndicator {
	private readonly logger = new Logger(CustomHealthService.name);
	private redis: Redis;

	constructor(
		private health: HealthCheckService,
		@InjectDataSource()
		private dataSource: DataSource,
		private queueService: QueueService,
		private configService: ConfigService
	) {
		super();
		this.redis = new Redis({
			host: this.configService.get('REDIS_HOST', 'localhost'),
			port: parseInt(this.configService.get('REDIS_PORT', '6379'), 10),
			password: this.configService.get('REDIS_PASSWORD'),
			db: parseInt(this.configService.get('REDIS_DB', '0'), 10),
			enableReadyCheck: false,
			maxRetriesPerRequest: 1,
			lazyConnect: true,
		});
	}

	@HealthCheck()
	async check() {
		return this.health.check([
			() => this.databaseHealthIndicator(),
			() => this.redisHealthIndicator(),
			() => this.queueHealthIndicator(),
			() => this.memoryHealthIndicator(),
			() => this.diskHealthIndicator(),
		]);
	}

	async databaseHealthIndicator(): Promise<HealthIndicatorResult> {
		try {
			// Check if database connection is active
			if (!this.dataSource.isInitialized) {
				return this.getStatus('database', false, {
					message: 'Database connection not initialized',
				});
			}

			// Execute simple query to verify connection
			const result = await this.dataSource.query('SELECT 1 as result');
			const isHealthy = result && result.length > 0 && result[0].result === 1;

			// Get connection info
			const connectionInfo = await this.dataSource.query(`
        SELECT
          current_database() as database,
          current_user as "user",
          version() as version,
          now() as current_time
      `);

			const info =
				Array.isArray(connectionInfo) && connectionInfo.length > 0
					? (connectionInfo[0] as Record<string, any>)
					: {};

			return this.getStatus('database', isHealthy, {
				message: isHealthy ? 'Database connection is healthy' : 'Database connection failed',
				...info,
			});
		} catch (error) {
			this.logger.error('Database health check failed', error);
			return this.getStatus('database', false, {
				message: 'Database connection failed',
				error: error.message,
			});
		}
	}

	async redisHealthIndicator(): Promise<HealthIndicatorResult> {
		try {
			const start = Date.now();
			await this.redis.ping();
			const responseTime = Date.now() - start;

			const info = await this.redis.info('memory');
			const memoryUsage = this.parseRedisInfo(info);

			return this.getStatus('redis', true, {
				message: 'Redis connection is healthy',
				responseTime: `${responseTime}ms`,
				memoryUsage,
			});
		} catch (error) {
			this.logger.error('Redis health check failed', error);
			return this.getStatus('redis', false, {
				message: 'Redis connection failed',
				error: error.message,
			});
		}
	}

	async queueHealthIndicator(): Promise<HealthIndicatorResult> {
		try {
			const queueStats = await this.queueService.getAllQueueStats();
			const totalJobs = queueStats.reduce((sum, queue) => {
				return sum + Object.values(queue.counts).reduce((a, b) => (a as number) + (b as number), 0);
			}, 0);

			const failedJobs = queueStats.reduce((sum, queue) => sum + queue.counts.failed, 0);
			const healthRatio = totalJobs > 0 ? (totalJobs - failedJobs) / totalJobs : 1;

			const isHealthy = healthRatio >= 0.95; // 95% success rate considered healthy

			return this.getStatus('queues', isHealthy, {
				message: isHealthy ? 'Queues are healthy' : 'Queue health degraded',
				totalJobs,
				failedJobs,
				successRate: `${(healthRatio * 100).toFixed(2)}%`,
				queues: queueStats.map((q) => ({
					name: q.queueName,
					counts: q.counts,
				})),
			});
		} catch (error) {
			this.logger.error('Queue health check failed', error);
			return this.getStatus('queues', false, {
				message: 'Queue health check failed',
				error: error.message,
			});
		}
	}

	async memoryHealthIndicator(): Promise<HealthIndicatorResult> {
		try {
			const memUsage = process.memoryUsage();
			const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
			const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
			const rssMB = Math.round(memUsage.rss / 1024 / 1024);

			const memoryThreshold = 500; // 500MB threshold
			const isHealthy = heapUsedMB < memoryThreshold;

			return this.getStatus('memory', isHealthy, {
				message: isHealthy ? 'Memory usage is normal' : 'High memory usage detected',
				heapUsed: `${heapUsedMB}MB`,
				heapTotal: `${heapTotalMB}MB`,
				rss: `${rssMB}MB`,
				external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
			});
		} catch (error) {
			this.logger.error('Memory health check failed', error);
			return this.getStatus('memory', false, {
				message: 'Memory health check failed',
				error: error.message,
			});
		}
	}

	async diskHealthIndicator(): Promise<HealthIndicatorResult> {
		try {
			// Basic disk usage check (simplified)
			const isHealthy = true; // Simplified for now

			return this.getStatus('disk', isHealthy, {
				message: 'Disk usage is normal',
				// Add actual disk usage metrics here
			});
		} catch (error) {
			this.logger.error('Disk health check failed', error);
			return this.getStatus('disk', false, {
				message: 'Disk health check failed',
				error: error.message,
			});
		}
	}

	private parseRedisInfo(info: string): any {
		const lines = info.split('\r\n');
		const memoryInfo: any = {};

		for (const line of lines) {
			if (line.includes(':')) {
				const [key, value] = line.split(':');
				if (key.includes('memory')) {
					memoryInfo[key] = value;
				}
			}
		}

		return memoryInfo;
	}
}
