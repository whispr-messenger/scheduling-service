import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { ScheduledMessage, ScheduledMessageStatus } from '../entities/scheduled-message.entity';
import { MessagingGrpcClient } from '@/modules/grpc/clients/messaging.client';

// Mock minimal du driver ioredis pour eviter d'ouvrir une connexion reelle.
type RedisMock = {
	set: jest.Mock;
	del: jest.Mock;
	runScript: jest.Mock;
	quit: jest.Mock;
};

const redisMock: RedisMock = {
	set: jest.fn(),
	del: jest.fn(),
	runScript: jest.fn(),
	quit: jest.fn(),
};

jest.mock('ioredis', () => {
	const ctor = jest.fn().mockImplementation(() => ({
		set: redisMock.set,
		del: redisMock.del,
		// On expose la cle "eval" attendue par ioredis vers notre mock.
		eval: redisMock.runScript,
		quit: redisMock.quit,
	}));
	return { __esModule: true, default: ctor };
});

describe('ScheduledMessagesService', () => {
	let service: ScheduledMessagesService;
	let repository: {
		create: jest.Mock;
		save: jest.Mock;
		find: jest.Mock;
		findOne: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let messagingClient: { sendScheduledMessage: jest.Mock };
	// QueryBuilder fluent partage par tous les tests : permet de configurer le
	// retour du UPDATE ... RETURNING * utilise par claimDueMessages.
	let queryBuilder: {
		update: jest.Mock;
		set: jest.Mock;
		where: jest.Mock;
		returning: jest.Mock;
		execute: jest.Mock;
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		queryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			returning: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ raw: [] }),
		};

		repository = {
			create: jest.fn((entity) => entity),
			save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'persisted-id' })),
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
		};

		messagingClient = {
			sendScheduledMessage: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ScheduledMessagesService,
				{
					provide: getRepositoryToken(ScheduledMessage),
					useValue: repository,
				},
				{
					provide: MessagingGrpcClient,
					useValue: messagingClient,
				},
				{
					provide: ConfigService,
					useValue: { get: jest.fn() },
				},
			],
		}).compile();

		service = module.get<ScheduledMessagesService>(ScheduledMessagesService);
	});

	describe('create', () => {
		it('persiste le userId provenant de la JWT, jamais celui du DTO', async () => {
			const futureDate = new Date(Date.now() + 60_000).toISOString();
			const jwtUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
			const dto = {
				conversationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
				content: 'hello',
				scheduledAt: futureDate,
			};

			await service.create(jwtUserId, dto);

			expect(repository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: jwtUserId,
					conversationId: dto.conversationId,
					status: ScheduledMessageStatus.PENDING,
				})
			);
		});

		it('refuse une date passee', async () => {
			await expect(
				service.create('uid', {
					conversationId: 'cid',
					content: 'x',
					scheduledAt: new Date(Date.now() - 1000).toISOString(),
				})
			).rejects.toThrow('scheduled_at must be in the future');
		});
	});

	describe('findOne / update / cancel — scoping par userId', () => {
		it('findOne scope la query au userId fourni', async () => {
			repository.findOne.mockResolvedValue(null);
			await expect(service.findOne('msg-id', 'user-A')).rejects.toThrow('not found');
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: 'msg-id', userId: 'user-A' },
			});
		});

		it('update scope la query au userId fourni', async () => {
			repository.findOne.mockResolvedValue(null);
			await expect(service.update('msg-id', 'user-A', { content: 'x' })).rejects.toThrow('not found');
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: 'msg-id', userId: 'user-A' },
			});
		});

		it('cancel scope la query au userId fourni', async () => {
			repository.findOne.mockResolvedValue(null);
			await expect(service.cancel('msg-id', 'user-A')).rejects.toThrow('not found');
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: 'msg-id', userId: 'user-A' },
			});
		});
	});

	describe('processDueMessages — Redis lock', () => {
		it('utilise un owner ID unique pour SET NX et un script Lua au release', async () => {
			redisMock.set.mockResolvedValue('OK');
			redisMock.runScript.mockResolvedValue(1);
			repository.find.mockResolvedValue([]);

			await service.processDueMessages();

			expect(redisMock.set).toHaveBeenCalledTimes(1);
			const [, ownerIdAtAcquire] = redisMock.set.mock.calls[0];
			expect(typeof ownerIdAtAcquire).toBe('string');
			expect(ownerIdAtAcquire).toMatch(/^\d+:/);

			expect(redisMock.runScript).toHaveBeenCalledTimes(1);
			const scriptArgs = redisMock.runScript.mock.calls[0];
			// Signature ioredis : (script, numKeys, key, argv...)
			expect(scriptArgs[0]).toContain("redis.call('get', KEYS[1])");
			expect(scriptArgs[0]).toContain("redis.call('del', KEYS[1])");
			expect(scriptArgs[1]).toBe(1);
			expect(scriptArgs[2]).toBe('scheduled-messages:lock:process');
			expect(scriptArgs[3]).toBe(ownerIdAtAcquire);

			// Plus jamais de DEL bare : c'etait la vulnerabilite.
			expect(redisMock.del).not.toHaveBeenCalled();
		});

		it("n'execute pas le batch si le lock est deja pris", async () => {
			redisMock.set.mockResolvedValue(null);

			await service.processDueMessages();

			expect(repository.find).not.toHaveBeenCalled();
			// Pas de release puisqu'on a pas pris le lock.
			expect(redisMock.runScript).not.toHaveBeenCalled();
		});

		it('release atomique meme si le batch jette une exception', async () => {
			redisMock.set.mockResolvedValue('OK');
			redisMock.runScript.mockResolvedValue(1);
			repository.find.mockRejectedValue(new Error('db down'));

			await service.processDueMessages();

			expect(redisMock.runScript).toHaveBeenCalledTimes(1);
		});

		it('claim atomique : marque les messages PROCESSING avant envoi', async () => {
			redisMock.set.mockResolvedValue('OK');
			redisMock.runScript.mockResolvedValue(1);

			const dueMessage = {
				id: 'msg-1',
				userId: 'u',
				conversationId: 'c',
				content: 'hello',
				metadata: null,
				scheduledAt: new Date(Date.now() - 1000),
				status: ScheduledMessageStatus.PENDING,
			};

			repository.find.mockResolvedValue([{ id: dueMessage.id }]);
			queryBuilder.execute.mockResolvedValue({ raw: [dueMessage] });
			messagingClient.sendScheduledMessage.mockResolvedValue({ ok: true });

			await service.processDueMessages();

			// Le SELECT initial doit ne demander que les IDs.
			expect(repository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ status: ScheduledMessageStatus.PENDING }),
					select: ['id'],
				})
			);

			// L'UPDATE doit poser le filtre status=PENDING (claim atomique).
			expect(queryBuilder.set).toHaveBeenCalledWith({ status: ScheduledMessageStatus.PROCESSING });
			expect(queryBuilder.where).toHaveBeenCalledWith(
				expect.objectContaining({ status: ScheduledMessageStatus.PENDING })
			);

			// Le message claim a bien ete envoye.
			expect(messagingClient.sendScheduledMessage).toHaveBeenCalledTimes(1);
		});

		it('lock expire : un 2e processDueMessages ne retraite pas les messages deja PROCESSING', async () => {
			redisMock.set.mockResolvedValue('OK');
			redisMock.runScript.mockResolvedValue(1);

			// Pod A claim le message au 1er tick.
			const claimedMessage = {
				id: 'msg-already-claimed',
				userId: 'u',
				conversationId: 'c',
				content: 'hello',
				metadata: null,
				scheduledAt: new Date(Date.now() - 1000),
				status: ScheduledMessageStatus.PENDING,
			};
			repository.find.mockResolvedValueOnce([{ id: claimedMessage.id }]);
			queryBuilder.execute.mockResolvedValueOnce({ raw: [claimedMessage] });
			messagingClient.sendScheduledMessage.mockResolvedValue({ ok: true });

			await service.processDueMessages();
			expect(messagingClient.sendScheduledMessage).toHaveBeenCalledTimes(1);

			messagingClient.sendScheduledMessage.mockClear();

			// 2e tick : pod B prend le lock (le notre a expire). La candidate query
			// ne renvoie aucun nouveau PENDING, et meme si elle en renvoyait, l'UPDATE
			// conditionne sur status=PENDING ne matcherait plus rien.
			repository.find.mockResolvedValueOnce([]);
			queryBuilder.execute.mockResolvedValueOnce({ raw: [] });

			await service.processDueMessages();

			expect(messagingClient.sendScheduledMessage).not.toHaveBeenCalled();
		});

		it('deux instances ont des owner IDs distincts (cas multi-pod)', async () => {
			redisMock.set.mockResolvedValue('OK');
			redisMock.runScript.mockResolvedValue(1);
			repository.find.mockResolvedValue([]);

			await service.processDueMessages();
			const ownerA = redisMock.set.mock.calls[0][1];

			// On instancie un second service pour simuler un autre pod.
			const moduleB: TestingModule = await Test.createTestingModule({
				providers: [
					ScheduledMessagesService,
					{ provide: getRepositoryToken(ScheduledMessage), useValue: repository },
					{ provide: MessagingGrpcClient, useValue: messagingClient },
					{ provide: ConfigService, useValue: { get: jest.fn() } },
				],
			}).compile();
			const serviceB = moduleB.get<ScheduledMessagesService>(ScheduledMessagesService);

			redisMock.set.mockClear();
			redisMock.set.mockResolvedValue('OK');
			await serviceB.processDueMessages();
			const ownerB = redisMock.set.mock.calls[0][1];

			expect(ownerA).not.toBe(ownerB);
		});
	});
});
