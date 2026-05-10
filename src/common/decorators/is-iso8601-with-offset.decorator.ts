import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// Format ISO 8601 avec offset timezone explicite (Z ou +HH:MM / -HH:MM).
// On rejette les datetime naives type "2026-05-09T09:00:00" : sans offset,
// new Date(...) interprete la string comme UTC dans Node, ce qui decale
// l'envoi du message de plusieurs heures pour tout client en heure locale.
const ISO_8601_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Valide qu'une string est ISO 8601 ET contient un offset timezone explicite.
 * Accepte : "2026-05-09T09:00:00Z", "2026-05-09T09:00:00+02:00",
 *           "2026-05-09T09:00:00.123-05:00".
 * Rejette : "2026-05-09T09:00:00", "2026-05-09", "09:00".
 */
export function IsISO8601WithOffset(validationOptions?: ValidationOptions): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			name: 'isISO8601WithOffset',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					if (typeof value !== 'string') {
						return false;
					}
					if (!ISO_8601_WITH_OFFSET.test(value)) {
						return false;
					}
					// Sanity check : la string doit etre parseable en Date valide.
					return !Number.isNaN(new Date(value).getTime());
				},
				defaultMessage(args: ValidationArguments): string {
					return `${args.property} must be an ISO 8601 datetime with explicit timezone offset (e.g. 2026-05-09T09:00:00+02:00 or 2026-05-09T09:00:00Z)`;
				},
			},
		});
	};
}
