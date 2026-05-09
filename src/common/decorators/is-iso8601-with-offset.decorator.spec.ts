import { validate } from 'class-validator';
import { IsISO8601WithOffset } from './is-iso8601-with-offset.decorator';

class Sample {
	@IsISO8601WithOffset()
	scheduledAt!: string;
}

const buildSample = (value: unknown): Sample => {
	const s = new Sample();
	(s as { scheduledAt: unknown }).scheduledAt = value;
	return s;
};

describe('IsISO8601WithOffset', () => {
	it.each([
		'2026-05-09T09:00:00Z',
		'2026-05-09T09:00:00+02:00',
		'2026-05-09T09:00:00-05:00',
		'2026-05-09T09:00:00.123+02:00',
		'2026-12-31T23:59:59.999Z',
	])('accepte %s', async (value) => {
		const errors = await validate(buildSample(value));
		expect(errors).toHaveLength(0);
	});

	it.each([
		// Sans offset : c'est le bug WHISPR-1355.
		['2026-05-09T09:00:00', 'datetime naive sans offset'],
		['2026-05-09', 'date sans heure'],
		['09:00:00Z', 'heure seule'],
		['2026/05/09T09:00:00Z', 'separateur invalide'],
		['', 'string vide'],
		['not-a-date', 'pas un datetime'],
		['2026-05-09T09:00:00+2:00', 'offset non zero-pad'],
		['2026-05-09T09:00:00 +02:00', 'espace avant offset'],
	])('rejette %s (%s)', async (value) => {
		const errors = await validate(buildSample(value));
		expect(errors).toHaveLength(1);
		expect(errors[0].constraints?.isISO8601WithOffset).toMatch(/timezone offset/);
	});

	it.each<[unknown, string]>([
		[null, 'null'],
		[undefined, 'undefined'],
		[123, 'number'],
		[{}, 'object'],
	])('rejette les non-string : %s (%s)', async (value) => {
		const errors = await validate(buildSample(value));
		expect(errors).toHaveLength(1);
	});
});
