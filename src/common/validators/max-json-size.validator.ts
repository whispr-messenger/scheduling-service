import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

const MAX_PAYLOAD_BYTES = 8192;

/**
 * Verifie que la serialisation JSON d'un objet ne depasse pas 8 Ko.
 * Borne le payload des jobs pour eviter des abus de stockage et des
 * messages trop volumineux dans les queues Bull/Redis.
 */
@ValidatorConstraint({ name: 'MaxJsonSize', async: false })
export class MaxJsonSizeConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		try {
			return JSON.stringify(value).length <= MAX_PAYLOAD_BYTES;
		} catch {
			// Si la serialisation echoue (circulaire, etc.) on refuse.
			return false;
		}
	}

	defaultMessage(args: ValidationArguments): string {
		return `${args.property} serialized JSON must not exceed ${MAX_PAYLOAD_BYTES} bytes`;
	}
}
