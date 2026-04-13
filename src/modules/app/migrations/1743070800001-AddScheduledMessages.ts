import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledMessages1743070800001 implements MigrationInterface {
	name = 'AddScheduledMessages1743070800001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."scheduled_messages_status_enum" AS ENUM('pending', 'sent', 'cancelled', 'failed')`
		);

		await queryRunner.query(`
			CREATE TABLE "scheduled_messages" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"user_id" uuid NOT NULL,
				"conversation_id" uuid NOT NULL,
				"content" text NOT NULL,
				"metadata" jsonb DEFAULT NULL,
				"scheduled_at" TIMESTAMP NOT NULL,
				"status" "public"."scheduled_messages_status_enum" NOT NULL DEFAULT 'pending',
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_scheduled_messages" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_scheduled_messages_user_id" ON "scheduled_messages" ("user_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_scheduled_messages_status_scheduled_at" ON "scheduled_messages" ("status", "scheduled_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_scheduled_messages_conversation_id" ON "scheduled_messages" ("conversation_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "scheduled_messages"`);
		await queryRunner.query(`DROP TYPE "public"."scheduled_messages_status_enum"`);
	}
}
