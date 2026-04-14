import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type RedisPubSubHandler = (channel: string, message: string) => Promise<void> | void;

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RedisPubSubService.name);
	private publisher: Redis;
	private subscriber: Redis;
	private readonly handlers = new Map<string, Set<RedisPubSubHandler>>();

	constructor(private readonly configService: ConfigService) {}

	onModuleInit(): void {
		const connectionOptions = this.buildConnectionOptions();
		this.publisher = new Redis(connectionOptions);
		this.subscriber = new Redis(connectionOptions);

		this.publisher.on('error', (err) => this.logger.error('Redis publisher error', err.message));
		this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err.message));

		this.subscriber.on('message', (channel, message) => {
			const channelHandlers = this.handlers.get(channel);
			if (!channelHandlers) {
				return;
			}
			for (const handler of channelHandlers) {
				Promise.resolve(handler(channel, message)).catch((err) => {
					this.logger.error('Pub/sub handler failed', { channel, error: err?.message });
				});
			}
		});
	}

	async onModuleDestroy(): Promise<void> {
		await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
	}

	async publish(channel: string, payload: unknown): Promise<number> {
		const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
		const receivers = await this.publisher.publish(channel, message);
		this.logger.debug?.('Published Redis pub/sub message', { channel, receivers });
		return receivers;
	}

	async subscribe(channel: string, handler: RedisPubSubHandler): Promise<void> {
		const existing = this.handlers.get(channel);
		if (existing) {
			existing.add(handler);
			return;
		}

		this.handlers.set(channel, new Set([handler]));
		await this.subscriber.subscribe(channel);
		this.logger.log('Subscribed to Redis channel', { channel });
	}

	async unsubscribe(channel: string, handler?: RedisPubSubHandler): Promise<void> {
		const existing = this.handlers.get(channel);
		if (!existing) {
			return;
		}

		if (handler) {
			existing.delete(handler);
			if (existing.size > 0) {
				return;
			}
		}

		this.handlers.delete(channel);
		await this.subscriber.unsubscribe(channel);
	}

	private buildConnectionOptions() {
		return {
			host: this.configService.get<string>('REDIS_HOST', 'localhost'),
			port: Number(this.configService.get('REDIS_PORT', 6379)),
			password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
			db: Number(this.configService.get('REDIS_DB', 0)),
			lazyConnect: false,
			maxRetriesPerRequest: null,
		};
	}
}
