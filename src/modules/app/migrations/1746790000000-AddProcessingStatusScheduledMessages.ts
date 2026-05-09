import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la valeur 'processing' a l'enum scheduled_messages_status_enum.
 * Etat intermediaire utilise par processDueMessages pour claim atomiquement
 * les messages avant envoi (evite le double-send sur lock Redis expire).
 */
export class AddProcessingStatusScheduledMessages1746790000000 implements MigrationInterface {
	name = 'AddProcessingStatusScheduledMessages1746790000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "public"."scheduled_messages_status_enum" ADD VALUE IF NOT EXISTS 'processing'`
		);
	}

	public async down(): Promise<void> {
		// PostgreSQL ne supporte pas DROP VALUE sur un enum.
		// Si rollback necessaire : recreer l'enum sans 'processing' + cast colonne.
		// On laisse intentionnellement vide : la valeur ajoutee n'est pas bloquante.
	}
}
