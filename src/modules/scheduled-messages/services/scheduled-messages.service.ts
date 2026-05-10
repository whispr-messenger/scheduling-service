import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ScheduledMessage, ScheduledMessageStatus } from '../entities/scheduled-message.entity';
import { CreateScheduledMessageDto } from '../dto/create-scheduled-message.dto';
import { UpdateScheduledMessageDto } from '../dto/update-scheduled-message.dto';
import { ScheduledMessageResponseDto } from '../dto/scheduled-message-response.dto';
import { MessagingGrpcClient } from '@/modules/grpc/clients/messaging.client';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { buildRedisOptions } from '@/config/redis.config';

const LOCK_KEY_PREFIX = 'scheduled-messages:lock:';
const LOCK_TTL_SECONDS = 55;
// Horizon max d'un message programme : 1 an. Au-dela on refuse pour eviter
// des enregistrements fantomes et des abus de stockage.
const MAX_SCHEDULE_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;
// Taille max d'un batch claim. Bornee pour eviter qu'un seul tick monopolise
// la connexion DB et garder une latence d'envoi previsible.
const PROCESS_BATCH_SIZE = 100;
// Plafond de retry sur erreur transiente avant de basculer en FAILED definitif.
// 3 tentatives = ~3 minutes de tolerance (cron par minute), suffisant pour
// absorber un redeploiement messaging-service ou une coupure reseau breve.
const RETRY_LIMIT = 3;
// Codes HTTP consideres comme transients (le retry a une chance de reussir).
// 408 timeout, 429 throttling, 503 unavailable, 504 gateway timeout.
const TRANSIENT_HTTP_STATUS = new Set([408, 429, 502, 503, 504]);
// Codes erreur reseau Node consideres comme transients.
const TRANSIENT_NETWORK_CODES = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'ENOTFOUND',
	'EPIPE',
]);
// Codes gRPC transients : UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED.
const TRANSIENT_GRPC_CODES = new Set([4, 8, 10, 14]);

// Lua atomique : ne supprime la cle que si la valeur appartient a ce process.
// Evite qu'un pod expire son lock et delete celui d'un autre pod.
const RELEASE_LOCK_LUA = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end`;

@Injectable()
export class ScheduledMessagesService {
	private readonly logger = new Logger(ScheduledMessagesService.name);
	private readonly redis: Redis;
	// Identifiant unique du process : sert de owner pour le lock distribue.
	// Genere une seule fois par instance, persiste tant que le pod est up.
	private readonly lockOwnerId = `${process.pid}:${randomUUID()}`;

	constructor(
		@InjectRepository(ScheduledMessage)
		private readonly scheduledMessageRepository: Repository<ScheduledMessage>,
		private readonly messagingClient: MessagingGrpcClient,
		private readonly configService: ConfigService
	) {
		this.redis = new Redis(buildRedisOptions(this.configService));
	}

	async create(userId: string, dto: CreateScheduledMessageDto): Promise<ScheduledMessageResponseDto> {
		const scheduledAt = new Date(dto.scheduledAt);
		const now = new Date();

		if (scheduledAt <= now) {
			throw new BadRequestException('scheduled_at must be in the future');
		}

		if (scheduledAt.getTime() - now.getTime() > MAX_SCHEDULE_HORIZON_MS) {
			throw new BadRequestException('scheduled_at must be within 1 year from now');
		}

		const message = this.scheduledMessageRepository.create({
			userId,
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
		const message = await this.findOwnedOrThrow(id, userId);
		return this.toResponse(message);
	}

	async update(
		id: string,
		userId: string,
		dto: UpdateScheduledMessageDto
	): Promise<ScheduledMessageResponseDto> {
		const message = await this.findOwnedOrThrow(id, userId);

		if (message.status !== ScheduledMessageStatus.PENDING) {
			throw new BadRequestException(
				`Cannot update a scheduled message with status "${message.status}". Only pending messages can be updated.`
			);
		}

		if (dto.scheduledAt) {
			const newScheduledAt = new Date(dto.scheduledAt);
			const now = new Date();
			if (newScheduledAt <= now) {
				throw new BadRequestException('scheduled_at must be in the future');
			}
			if (newScheduledAt.getTime() - now.getTime() > MAX_SCHEDULE_HORIZON_MS) {
				throw new BadRequestException('scheduled_at must be within 1 year from now');
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
		const message = await this.findOwnedOrThrow(id, userId);

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
	 * Defense-in-depth : verifie l'ownership cote service, peu importe le transport.
	 * Si demain ce service est appele par un handler gRPC ou un event listener qui
	 * oublie de scoper, on n'expose pas une IDOR. Le predicat SQL { id, userId }
	 * fait le boulot, et un userId vide est traite comme un not-found pour eviter
	 * qu'un appelant sans contexte JWT ne puisse passer un id seul.
	 */
	private async findOwnedOrThrow(id: string, userId: string): Promise<ScheduledMessage> {
		if (!userId) {
			throw new NotFoundException(`Scheduled message with ID ${id} not found`);
		}

		const message = await this.scheduledMessageRepository.findOne({
			where: { id, userId },
		});

		if (!message) {
			throw new NotFoundException(`Scheduled message with ID ${id} not found`);
		}

		return message;
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
			const claimed = await this.claimDueMessages();

			if (claimed.length === 0) {
				return;
			}

			this.logger.log(`Processing ${claimed.length} due scheduled message(s)`);

			for (const message of claimed) {
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

	/**
	 * Claim atomique des messages dus :
	 *  1. SELECT des IDs PENDING dont scheduledAt <= now (borne PROCESS_BATCH_SIZE).
	 *  2. UPDATE ... SET status = PROCESSING WHERE id IN (...) AND status = PENDING
	 *     RETURNING * — l'UPDATE pose un row-level lock cote PostgreSQL, donc deux
	 *     pods ne peuvent pas claim le meme enregistrement.
	 *
	 * Si notre lock Redis expire en cours de boucle, le pod suivant ne verra plus
	 * ces messages comme PENDING, donc ne les retraitera pas. Plus de double-send.
	 */
	private async claimDueMessages(): Promise<ScheduledMessage[]> {
		const now = new Date();

		const candidates = await this.scheduledMessageRepository.find({
			where: {
				status: ScheduledMessageStatus.PENDING,
				scheduledAt: LessThanOrEqual(now),
			},
			order: { scheduledAt: 'ASC' },
			take: PROCESS_BATCH_SIZE,
			select: ['id'],
		});

		if (candidates.length === 0) {
			return [];
		}

		const candidateIds = candidates.map((m) => m.id);

		// UPDATE conditionne sur status=PENDING : si un autre process a deja claim
		// la ligne, le predicat ne match plus et la ligne n'est pas retournee.
		const claimResult = await this.scheduledMessageRepository
			.createQueryBuilder()
			.update(ScheduledMessage)
			.set({ status: ScheduledMessageStatus.PROCESSING })
			.where({
				id: In(candidateIds),
				status: ScheduledMessageStatus.PENDING,
			})
			.returning('*')
			.execute();

		const raw = (claimResult.raw ?? []) as ScheduledMessage[];
		return this.scheduledMessageRepository.create(raw);
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
			const transient = this.isTransientError(error);
			const canRetry = transient && message.retryCount < RETRY_LIMIT;

			if (canRetry) {
				// On ramene le message en PENDING pour que le prochain tick
				// le re-claim. Increment du compteur pour cap les retries.
				message.retryCount += 1;
				message.status = ScheduledMessageStatus.PENDING;
				await this.scheduledMessageRepository.save(message);

				this.logger.warn('Scheduled message send failed (transient), will retry', {
					id: message.id,
					retryCount: message.retryCount,
					retryLimit: RETRY_LIMIT,
					error: error.message,
				});
				return;
			}

			message.status = ScheduledMessageStatus.FAILED;
			await this.scheduledMessageRepository.save(message);

			this.logger.error('Failed to send scheduled message', {
				id: message.id,
				retryCount: message.retryCount,
				transient,
				error: error.message,
			});
		}
	}

	/**
	 * Heuristique pour distinguer une erreur transiente d'une erreur permanente.
	 * Transient : timeout, 5xx, ECONNREFUSED, ECONNRESET, gRPC UNAVAILABLE, etc.
	 * Permanent : 4xx (404 conversation deleted, 410 gone, validation, user inconnu).
	 * fail-closed: shape inconnue = traiter comme permanent (eviter retry storm).
	 */
	private isTransientError(error: unknown): boolean {
		if (!error || typeof error !== 'object') {
			return false;
		}

		const err = error as {
			code?: string | number;
			status?: number;
			statusCode?: number;
			response?: { status?: number };
		};

		// Erreur reseau Node (ECONNREFUSED, ECONNRESET, ETIMEDOUT...).
		if (typeof err.code === 'string' && TRANSIENT_NETWORK_CODES.has(err.code)) {
			return true;
		}

		// gRPC status code numerique.
		if (typeof err.code === 'number' && TRANSIENT_GRPC_CODES.has(err.code)) {
			return true;
		}

		// HTTP status (axios met response.status, certains clients mettent status/statusCode).
		const httpStatus = err.response?.status ?? err.status ?? err.statusCode;
		if (typeof httpStatus === 'number') {
			// 404 conversation deleted / 410 gone : permanent explicite, jamais retry.
			if (httpStatus === 404 || httpStatus === 410) {
				return false;
			}
			if (TRANSIENT_HTTP_STATUS.has(httpStatus)) {
				return true;
			}
			// 4xx (hors transients deja matches) = permanent : payload invalide,
			// user inconnu, droits manquants — un retry n'aidera pas.
			if (httpStatus >= 400 && httpStatus < 500) {
				return false;
			}
			// 5xx restant : transient par defaut.
			if (httpStatus >= 500) {
				return true;
			}
		}

		// fail-closed: shape inconnue = traiter comme permanent (eviter retry storm).
		return false;
	}

	/**
	 * Acquires a distributed lock using Redis SET NX EX.
	 * Returns true if the lock was acquired, false otherwise.
	 * Stocke un owner ID unique pour permettre une release sure.
	 */
	private async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
		const result = await this.redis.set(key, this.lockOwnerId, 'EX', ttlSeconds, 'NX');
		return result === 'OK';
	}

	/**
	 * Release atomique via script Lua cote Redis : delete uniquement si la
	 * valeur correspond a notre owner ID. Sinon, le lock appartient a un autre
	 * pod (le notre a expire) et on ne touche a rien.
	 */
	private async releaseLock(key: string): Promise<void> {
		try {
			await this.redis.eval(RELEASE_LOCK_LUA, 1, key, this.lockOwnerId);
		} catch (error) {
			this.logger.warn('Failed to release scheduled-messages lock', {
				key,
				error: (error as Error).message,
			});
		}
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
