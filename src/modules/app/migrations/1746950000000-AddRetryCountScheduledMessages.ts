import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la colonne retry_count sur scheduled_messages.
 * Sert a compter les echecs transients (timeout, 5xx, ECONNREFUSED) avant
 * de basculer le message en FAILED definitif. Permet aux pannes momentanees
 * de messaging-service de ne pas perdre les messages programmes.
 */
export class AddRetryCountScheduledMessages1746950000000 implements MigrationInterface {
	name = 'AddRetryCountScheduledMessages1746950000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "scheduled_messages" DROP COLUMN IF EXISTS "retry_count"`);
	}
}
