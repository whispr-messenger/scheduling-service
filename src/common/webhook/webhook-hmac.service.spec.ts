import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookHmacService } from './webhook-hmac.service';
import { createHmac } from 'crypto';

const TEST_SECRET = 'test-secret-32-bytes-long-padded!!';

function buildHmac(secret: string, ts: number, body: string): string {
	return createHmac('sha256', secret).update(`${ts}.${body}`, 'utf8').digest('hex');
}

function makeModule(secret: string | undefined): Promise<TestingModule> {
	return Test.createTestingModule({
		providers: [
			WebhookHmacService,
			{
				provide: ConfigService,
				useValue: { get: (_key: string) => secret },
			},
		],
	}).compile();
}

describe('WebhookHmacService', () => {
	let service: WebhookHmacService;
	const NOW = 1_700_000_000;

	beforeEach(async () => {
		const module = await makeModule(TEST_SECRET);
		service = module.get<WebhookHmacService>(WebhookHmacService);
	});

	// ---- sign ----------------------------------------------------------------

	describe('sign', () => {
		it('emet x-whispr-timestamp et x-whispr-signature au format t=<ts>,v1=<hex>', () => {
			const headers = service.sign('{"hello":"world"}', NOW);

			expect(headers['x-whispr-timestamp']).toBe(String(NOW));
			expect(headers['x-whispr-signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
		});

		it('le timestamp dans la signature correspond a x-whispr-timestamp', () => {
			const body = '{"foo":1}';
			const headers = service.sign(body, NOW);

			const [tPart] = headers['x-whispr-signature'].split(',');
			expect(tPart).toBe(`t=${NOW}`);
			expect(headers['x-whispr-timestamp']).toBe(String(NOW));
		});

		it('la signature HMAC est reproductible avec le meme secret + ts + body', () => {
			const body = '{"msg":"hello"}';
			const expected = buildHmac(TEST_SECRET, NOW, body);
			const headers = service.sign(body, NOW);

			const v1 = headers['x-whispr-signature'].split('v1=')[1];
			expect(v1).toBe(expected);
		});

		it('deux body differents produisent des signatures differentes', () => {
			const h1 = service.sign('{"a":1}', NOW);
			const h2 = service.sign('{"a":2}', NOW);
			expect(h1['x-whispr-signature']).not.toBe(h2['x-whispr-signature']);
		});

		it('deux timestamps differents produisent des signatures differentes', () => {
			const body = '{"same":"body"}';
			const h1 = service.sign(body, NOW);
			const h2 = service.sign(body, NOW + 1);
			expect(h1['x-whispr-signature']).not.toBe(h2['x-whispr-signature']);
		});
	});

	// ---- verify : cas de succes ---------------------------------------------

	describe('verify - signature valide', () => {
		it('accepte une signature valide generee par sign()', () => {
			const body = '{"event":"job_done"}';
			const headers = service.sign(body, NOW);
			expect(service.verify(body, headers['x-whispr-signature'], NOW)).toBe(true);
		});

		it('accepte quand le timestamp est exactement dans la tolerance (+299 s)', () => {
			const body = '{"x":1}';
			const ts = NOW - 299;
			const sig = `t=${ts},v1=${buildHmac(TEST_SECRET, ts, body)}`;
			expect(service.verify(body, sig, NOW)).toBe(true);
		});

		it('accepte quand le timestamp est exactement dans la tolerance (-299 s)', () => {
			const body = '{"x":1}';
			const ts = NOW + 299;
			const sig = `t=${ts},v1=${buildHmac(TEST_SECRET, ts, body)}`;
			expect(service.verify(body, sig, NOW)).toBe(true);
		});
	});

	// ---- verify : rejets timestamp ------------------------------------------

	describe('verify - timestamp hors tolerance', () => {
		it('rejette un timestamp trop ancien (> 5 min)', () => {
			const body = '{"x":1}';
			const ts = NOW - 301;
			const sig = `t=${ts},v1=${buildHmac(TEST_SECRET, ts, body)}`;
			expect(service.verify(body, sig, NOW)).toBe(false);
		});

		it('rejette un timestamp trop futur (> 5 min)', () => {
			const body = '{"x":1}';
			const ts = NOW + 301;
			const sig = `t=${ts},v1=${buildHmac(TEST_SECRET, ts, body)}`;
			expect(service.verify(body, sig, NOW)).toBe(false);
		});

		it('rejette exactement a la limite +300 s (borne exclusive)', () => {
			const body = '{"x":1}';
			const ts = NOW - 300;
			const sig = `t=${ts},v1=${buildHmac(TEST_SECRET, ts, body)}`;
			// delta == TIMESTAMP_TOLERANCE_S : rejete (> strict)
			expect(service.verify(body, sig, NOW)).toBe(false);
		});
	});

	// ---- verify : rejets signature ------------------------------------------

	describe('verify - signature invalide', () => {
		it('rejette une signature modifiee (corps tamper)', () => {
			const originalBody = '{"amount":100}';
			const tamperedBody = '{"amount":999}';
			const headers = service.sign(originalBody, NOW);
			expect(service.verify(tamperedBody, headers['x-whispr-signature'], NOW)).toBe(false);
		});

		it('rejette un header de format invalide (manque v1)', () => {
			expect(service.verify('{}', `t=${NOW}`, NOW)).toBe(false);
		});

		it('rejette un header vide', () => {
			expect(service.verify('{}', '', NOW)).toBe(false);
		});

		it('rejette un header aleatoire', () => {
			expect(service.verify('{}', 'random-garbage-value', NOW)).toBe(false);
		});

		it('rejette une signature avec un digest de longueur differente', () => {
			// Digest tronque : longueur != 32 bytes -> rejet avant timingSafeEqual.
			const sig = `t=${NOW},v1=deadbeef`;
			expect(service.verify('{}', sig, NOW)).toBe(false);
		});

		it('rejette si le secret est different', async () => {
			const module = await makeModule('other-secret-entirely');
			const otherService = module.get<WebhookHmacService>(WebhookHmacService);

			const body = '{"x":1}';
			const headers = service.sign(body, NOW);
			expect(otherService.verify(body, headers['x-whispr-signature'], NOW)).toBe(false);
		});
	});

	// ---- construction sans secret -------------------------------------------

	describe('construction', () => {
		it('leve une erreur si WEBHOOK_HMAC_SECRET est absent', async () => {
			await expect(makeModule(undefined)).rejects.toThrow(
				'WEBHOOK_HMAC_SECRET is required but not set'
			);
		});

		it('leve une erreur si WEBHOOK_HMAC_SECRET est vide', async () => {
			await expect(makeModule('')).rejects.toThrow('WEBHOOK_HMAC_SECRET is required but not set');
		});
	});

	// ---- round-trip sign -> verify ------------------------------------------

	describe('round-trip sign -> verify', () => {
		it('signe puis verifie un payload JSON non trivial', () => {
			const body = JSON.stringify({ event: 'scheduled_message_sent', id: 'abc-123', retryCount: 2 });
			const headers = service.sign(body, NOW);
			expect(service.verify(body, headers['x-whispr-signature'], NOW)).toBe(true);
		});

		it('echoue si le body est modifie apres signature', () => {
			const body = '{"amount":50}';
			const headers = service.sign(body, NOW);
			const tampered = '{"amount":50000}';
			expect(service.verify(tampered, headers['x-whispr-signature'], NOW)).toBe(false);
		});
	});
});
