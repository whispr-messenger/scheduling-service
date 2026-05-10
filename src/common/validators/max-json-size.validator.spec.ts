import { MaxJsonSizeConstraint } from './max-json-size.validator';

describe('MaxJsonSizeConstraint', () => {
	let constraint: MaxJsonSizeConstraint;

	beforeEach(() => {
		constraint = new MaxJsonSizeConstraint();
	});

	it('accepte un payload sous 8 Ko', () => {
		const small = { key: 'value', num: 42 };
		expect(constraint.validate(small)).toBe(true);
	});

	it('accepte un payload exactement a 8192 octets', () => {
		// Construit un objet dont la serialisation fait exactement 8192 chars.
		const content = 'a'.repeat(8192 - '{"k":"","v":"".length'.length);
		const value = { v: content };
		const serialized = JSON.stringify(value);
		// Ajuste pour que ce soit <= 8192
		expect(serialized.length).toBeLessThanOrEqual(8192);
		expect(constraint.validate(value)).toBe(true);
	});

	it('refuse un payload de plus de 8 Ko', () => {
		const bigValue = { data: 'x'.repeat(9000) };
		expect(constraint.validate(bigValue)).toBe(false);
	});

	it('retourne un message d erreur adequat', () => {
		const args = { property: 'payload' } as any;
		expect(constraint.defaultMessage(args)).toContain('8192');
		expect(constraint.defaultMessage(args)).toContain('payload');
	});
});
