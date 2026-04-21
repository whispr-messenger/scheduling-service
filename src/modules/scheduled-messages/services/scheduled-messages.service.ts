import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ScheduledMessage, ScheduledMessageStatus } from '../entities/scheduled-message.entity';
import { CreateScheduledMessageDto } from '../dto/create-scheduled-message.dto';
import { UpdateScheduledMessageDto } from '../dto/update-scheduled-message.dto';
import { ScheduledMessageResponseDto } from '../dto/scheduled-message-response.dto';
import { MessagingGrpcClient } from '@/modules/grpc/clients/messaging.client';
import Redis from 'ioredis';
import { buildRedisOptions } from '@/config/redis.config';

const LOCK_KEY_PREFIX = 'scheduled-messages:lock:';
const LOCK_TTL_SECONDS = 55;

@Injectable()
export class ScheduledMessagesService {
	private readonly logger = new Logger(ScheduledMessagesService.name);
	private readonly redis: Redis;

	constructor(
		@InjectRepository(ScheduledMessage)
		private readonly scheduledMessageRepository: Repository<ScheduledMessage>,
		private readonly messagingClient: MessagingGrpcClient,
		private readonly configService: ConfigService
	) {
		this.redis = new Redis(buildRedisOptions(this.configService));
	}

	async create(dto: CreateScheduledMessageDto): Promise<ScheduledMessageResponseDto> {
		const scheduledAt = new Date(dto.scheduledAt);

		if (scheduledAt <= new Date()) {
			throw new BadRequestException('scheduled_at must be in the future');
		}

		const message = this.scheduledMessageRepository.create({
			userId: dto.userId,
			conversationId: dto.conversationId,
			content: dto.content,
			metadata: dto.metadata || null,
			scheduledAt,
			status: ScheduledMessageStatus.PENDING,
		});

		const saved = await this.scheduledMessageRepository.save(message);

		this.logger.log('Scheduled message created', {
			id: saved.id,
			userId: saved.userId,
			scheduledAt: saved.scheduledAt.toISOString(),
		});

		return this.toResponse(saved);
	}

	async findAllByUser(userId: string): Promise<ScheduledMessageResponseDto[]> {
		const messages = await this.scheduledMessageRepository.find({
			where: { userId },
			order: { scheduledAt: 'ASC' },
		});

		return messages.map((m) => this.toResponse(m));
	}

	async findOne(id: string, userId: string): Promise<ScheduledMessageResponseDto> {
		const message = await this.scheduledMessageRepository.findOne({
			where: { id, userId },
		});

		if (!message) {
			throw new NotFoundException(`Scheduled message with ID ${id} not found`);
		}

		return this.toResponse(message);
	}

	async update(
		id: string,
		userId: string,
		dto: UpdateScheduledMessageDto
	): Promise<ScheduledMessageResponseDto> {
		const message = await this.scheduledMessageRepository.findOne({
			where: { id, userId },
		});

		if (!message) {
			throw new NotFoundException(`Scheduled message with ID ${id} not found`);
		}

		if (message.status !== ScheduledMessageStatus.PENDING) {
			throw new BadRequestException(
				`Cannot update a scheduled message with status "${message.status}". Only pending messages can be updated.`
			);
		}

		if (dto.scheduledAt) {
			const newScheduledAt = new Date(dto.scheduledAt);
			if (newScheduledAt <= new Date()) {
				throw new BadRequestException('scheduled_at must be in the future');
			}
			message.scheduledAt = newScheduledAt;
		}

		if (dto.content !== undefined) {
			message.content = dto.content;
		}

		if (dto.metadata !== undefined) {
			message.metadata = dto.metadata;
		}

		const updated = await this.scheduledMessageRepository.save(message);

		this.logger.log('Scheduled message updated', { id: updated.id });

		return this.toResponse(updated);
	}

	async cancel(id: string, userId: string): Promise<void> {
		const message = await this.scheduledMessageRepository.findOne({
			where: { id, userId },
		});

		if (!message) {
			throw new NotFoundException(`Scheduled message with ID ${id} not found`);
		}

		if (message.status !== ScheduledMessageStatus.PENDING) {
			throw new BadRequestException(
				`Cannot cancel a scheduled message with status "${message.status}". Only pending messages can be cancelled.`
			);
		}

		message.status = ScheduledMessageStatus.CANCELLED;
		await this.scheduledMessageRepository.save(message);

		this.logger.log('Scheduled message cancelled', { id: message.id });
	}

	/**
	 * Cron job that runs every minute to process due scheduled messages.
	 * Uses a Redis lock to prevent duplicate processing in multi-instance deployments.
	 */
	@Cron(CronExpression.EVERY_MINUTE) // NOSONAR — internal cron, no external auth needed
	async processDueMessages(): Promise<void> {
		const lockKey = `${LOCK_KEY_PREFIX}process`;
		const lockAcquired = await this.acquireLock(lockKey, LOCK_TTL_SECONDS);

		if (!lockAcquired) {
			this.logger.debug('Another instance is already processing scheduled messages, skipping');
			return;
		}

		try {
			const dueMessages = await this.scheduledMessageRepository.find({
				where: {
					status: ScheduledMessageStatus.PENDING,
					scheduledAt: LessThanOrEqual(new Date()),
				},
				order: { scheduledAt: 'ASC' },
			});

			if (dueMessages.length === 0) {
				return;
			}

			this.logger.log(`Processing ${dueMessages.length} due scheduled message(s)`);

			for (const message of dueMessages) {
				await this.sendMessage(message);
			}
		} catch (error) {
			this.logger.error('Error processing due scheduled messages', {
				error: error.message,
				stack: error.stack,
			});
		} finally {
			await this.releaseLock(lockKey);
		}
	}

	private async sendMessage(message: ScheduledMessage): Promise<void> {
		try {
			await this.messagingClient.sendScheduledMessage({
				conversationId: message.conversationId,
				senderId: message.userId,
				messageType: 'TEXT',
				content: message.content,
				metadata: message.metadata || {},
				scheduledFor: message.scheduledAt,
			});

			message.status = ScheduledMessageStatus.SENT;
			await this.scheduledMessageRepository.save(message);

			this.logger.log('Scheduled message sent successfully', {
				id: message.id,
				conversationId: message.conversationId,
			});
		} catch (error) {
			message.status = ScheduledMessageStatus.FAILED;
			await this.scheduledMessageRepository.save(message);

			this.logger.error('Failed to send scheduled message', {
				id: message.id,
				error: error.message,
			});
		}
	}

	/**
	 * Acquires a distributed lock using Redis SET NX EX.
	 * Returns true if the lock was acquired, false otherwise.
	 */
	private async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
		const result = await this.redis.set(key, process.pid.toString(), 'EX', ttlSeconds, 'NX');
		return result === 'OK';
	}

	private async releaseLock(key: string): Promise<void> {
		await this.redis.del(key);
	}

	private toResponse(message: ScheduledMessage): ScheduledMessageResponseDto {
		return {
			id: message.id,
			userId: message.userId,
			conversationId: message.conversationId,
			content: message.content,
			metadata: message.metadata,
			scheduledAt: message.scheduledAt,
			status: message.status,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
		};
	}
}
