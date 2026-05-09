import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bascule scheduled_at, created_at, updated_at de TIMESTAMP (sans tz) vers
 * TIMESTAMPTZ. Sans cette colonne timezone-aware, l'envoi des messages
 * programmes pouvait deriver d'1-2h selon l'heure d'ete et le timezone de
 * session PostgreSQL (cf WHISPR-1355).
 *
 * Les valeurs deja persistees sont interpretees comme UTC : les ecritures
 * passees venaient de `new Date(dto.scheduledAt)` cote service Node, qui
 * sans offset traite la string comme UTC. On preserve donc l'instant absolu.
 */
export class AlterScheduledMessagesTimestamptz1746830000000 implements MigrationInterface {
	name = 'AlterScheduledMessagesTimestamptz1746830000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "scheduled_at" TYPE TIMESTAMPTZ USING "scheduled_at" AT TIME ZONE 'UTC'`
		);
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC'`
		);
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "scheduled_at" TYPE TIMESTAMP USING "scheduled_at" AT TIME ZONE 'UTC'`
		);
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC'`
		);
		await queryRunner.query(
			`ALTER TABLE "scheduled_messages"
				ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'`
		);
	}
}
