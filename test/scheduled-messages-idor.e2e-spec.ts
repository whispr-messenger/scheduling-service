import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ScheduledMessagesController } from '../src/modules/scheduled-messages/controllers/scheduled-messages.controller';
import { ScheduledMessagesService } from '../src/modules/scheduled-messages/services/scheduled-messages.service';

/**
 * Verifie que les endpoints scheduled-messages ne peuvent pas etre detournes
 * via un userId injecte dans la query ou le body : c'est strictement la JWT
 * (posee dans req.user par le JwtAuthGuard) qui scope les operations.
 */
describe('ScheduledMessages IDOR (e2e)', () => {
	let app: INestApplication;
	let serviceMock: {
		create: jest.Mock;
		findAllByUser: jest.Mock;
		findOne: jest.Mock;
		update: jest.Mock;
		cancel: jest.Mock;
	};
	const VICTIM_ID = '11111111-1111-4111-8111-111111111111';
	const ATTACKER_ID = '22222222-2222-4222-8222-222222222222';
	const MESSAGE_ID = '33333333-3333-4333-8333-333333333333';
	const CONVERSATION_ID = '44444444-4444-4444-8444-444444444444';

	beforeAll(async () => {
		serviceMock = {
			create: jest.fn().mockImplementation((userId: string, dto: any) =>
				Promise.resolve({
					id: MESSAGE_ID,
					userId,
					conversationId: dto.conversationId,
					content: dto.content,
					metadata: dto.metadata ?? null,
					scheduledAt: new Date(dto.scheduledAt),
					status: 'pending',
					createdAt: new Date(),
					updatedAt: new Date(),
				})
			),
			findAllByUser: jest
				.fn()
				.mockImplementation((userId: string) =>
					Promise.resolve([{ id: MESSAGE_ID, userId, conversationId: 'c', content: 'x' }])
				),
			findOne: jest
				.fn()
				.mockImplementation((id: string, userId: string) => Promise.resolve({ id, userId })),
			update: jest
				.fn()
				.mockImplementation((id: string, userId: string) => Promise.resolve({ id, userId })),
			cancel: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ScheduledMessagesController],
			providers: [{ provide: ScheduledMessagesService, useValue: serviceMock }],
		}).compile();

		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));

		// Middleware express qui simule le JwtAuthGuard : pose req.user comme
		// le vrai guard l'aurait fait apres validation de la JWT.
		app.use((req: any, _res: any, next: () => void) => {
			req.user = { userId: ATTACKER_ID, jti: 'jti', deviceId: 'dev' };
			next();
		});

		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		serviceMock.create.mockImplementation((userId: string, dto: any) =>
			Promise.resolve({
				id: MESSAGE_ID,
				userId,
				conversationId: dto.conversationId,
				content: dto.content,
				metadata: dto.metadata ?? null,
				scheduledAt: new Date(dto.scheduledAt),
				status: 'pending',
				createdAt: new Date(),
				updatedAt: new Date(),
			})
		);
		serviceMock.findAllByUser.mockImplementation((userId: string) =>
			Promise.resolve([{ id: MESSAGE_ID, userId, conversationId: 'c', content: 'x' }])
		);
		serviceMock.findOne.mockImplementation((id: string, userId: string) =>
			Promise.resolve({ id, userId })
		);
		serviceMock.update.mockImplementation((id: string, userId: string) =>
			Promise.resolve({ id, userId })
		);
	});

	it('POST ignore body.userId et utilise le userId de la JWT', async () => {
		const futureDate = new Date(Date.now() + 60_000).toISOString();
		const res = await request(app.getHttpServer()).post('/api/v1/scheduled-messages').send({
			userId: VICTIM_ID, // tentative d'IDOR : champ inconnu, doit etre strippe
			conversationId: CONVERSATION_ID,
			content: 'hello',
			scheduledAt: futureDate,
		});

		expect(res.status).toBe(201);
		expect(serviceMock.create).toHaveBeenCalledTimes(1);
		expect(serviceMock.create.mock.calls[0][0]).toBe(ATTACKER_ID);
		expect(serviceMock.create.mock.calls[0][1]).not.toHaveProperty('userId');
		expect(res.body.userId).toBe(ATTACKER_ID);
	});

	it('GET /scheduled-messages ignore ?userId=victim et scope sur la JWT', async () => {
		await request(app.getHttpServer()).get(`/api/v1/scheduled-messages?userId=${VICTIM_ID}`).expect(200);

		expect(serviceMock.findAllByUser).toHaveBeenCalledWith(ATTACKER_ID);
	});

	it('GET /scheduled-messages/:id ignore ?userId=victim', async () => {
		await request(app.getHttpServer())
			.get(`/api/v1/scheduled-messages/${MESSAGE_ID}?userId=${VICTIM_ID}`)
			.expect(200);

		expect(serviceMock.findOne).toHaveBeenCalledWith(MESSAGE_ID, ATTACKER_ID);
	});

	it('PATCH /scheduled-messages/:id ignore ?userId=victim', async () => {
		await request(app.getHttpServer())
			.patch(`/api/v1/scheduled-messages/${MESSAGE_ID}?userId=${VICTIM_ID}`)
			.send({ content: 'pwned' })
			.expect(200);

		expect(serviceMock.update).toHaveBeenCalledWith(
			MESSAGE_ID,
			ATTACKER_ID,
			expect.objectContaining({ content: 'pwned' })
		);
	});

	it('DELETE /scheduled-messages/:id ignore ?userId=victim', async () => {
		await request(app.getHttpServer())
			.delete(`/api/v1/scheduled-messages/${MESSAGE_ID}?userId=${VICTIM_ID}`)
			.expect(204);

		expect(serviceMock.cancel).toHaveBeenCalledWith(MESSAGE_ID, ATTACKER_ID);
	});
});
