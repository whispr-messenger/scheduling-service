import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1743070800000 implements MigrationInterface {
	name = 'InitialSchema1743070800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Enums
		await queryRunner.query(
			`CREATE TYPE "public"."priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."schedule_type_enum" AS ENUM('CRON', 'INTERVAL', 'ONCE', 'IMMEDIATE')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."execution_status_enum" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."log_level_enum" AS ENUM('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."dependency_type_enum" AS ENUM('SUCCESS', 'COMPLETION', 'FAILURE')`
		);

		// job_categories
		await queryRunner.query(`
			CREATE TABLE "job_categories" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"name" character varying(100) NOT NULL,
				"description" text,
				"default_priority" "public"."priority_enum" NOT NULL DEFAULT 'MEDIUM',
				"default_timeout" integer NOT NULL DEFAULT 300,
				"default_max_retries" integer NOT NULL DEFAULT 3,
				"configuration" jsonb NOT NULL DEFAULT '{}',
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "UQ_job_categories_name" UNIQUE ("name"),
				CONSTRAINT "PK_job_categories" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_job_categories_is_active" ON "job_categories" ("is_active")`
		);

		// jobs
		await queryRunner.query(`
			CREATE TABLE "jobs" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"name" character varying(200) NOT NULL,
				"description" text,
				"category_id" uuid NOT NULL,
				"target_service" character varying(100) NOT NULL,
				"target_method" character varying(100) NOT NULL,
				"payload" jsonb NOT NULL DEFAULT '{}',
				"priority" "public"."priority_enum" NOT NULL DEFAULT 'MEDIUM',
				"max_retries" integer NOT NULL DEFAULT 3,
				"timeout_seconds" integer NOT NULL DEFAULT 300,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_by" uuid,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				"deleted_at" TIMESTAMP,
				CONSTRAINT "PK_jobs" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_jobs_is_active" ON "jobs" ("is_active")`);
		await queryRunner.query(`CREATE INDEX "IDX_jobs_priority" ON "jobs" ("priority")`);
		await queryRunner.query(`CREATE INDEX "IDX_jobs_created_at" ON "jobs" ("created_at")`);
		await queryRunner.query(
			`ALTER TABLE "jobs" ADD CONSTRAINT "FK_jobs_category_id" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);

		// schedules
		await queryRunner.query(`
			CREATE TABLE "schedules" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"job_id" uuid NOT NULL,
				"schedule_type" "public"."schedule_type_enum" NOT NULL,
				"cron_expression" character varying(100),
				"interval_seconds" integer,
				"scheduled_at" TIMESTAMP,
				"timezone" character varying(50) NOT NULL DEFAULT 'UTC',
				"starts_at" TIMESTAMP,
				"ends_at" TIMESTAMP,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_schedules" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_schedules_is_active" ON "schedules" ("is_active")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_schedules_schedule_type" ON "schedules" ("schedule_type")`
		);
		await queryRunner.query(
			`ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// executions
		await queryRunner.query(`
			CREATE TABLE "executions" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"job_id" uuid NOT NULL,
				"schedule_id" uuid,
				"status" "public"."execution_status_enum" NOT NULL,
				"started_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"completed_at" TIMESTAMP,
				"failed_at" TIMESTAMP,
				"attempt_number" integer NOT NULL DEFAULT 1,
				"result_data" jsonb,
				"error_data" jsonb,
				"duration_ms" integer,
				"worker_id" character varying(100),
				"correlation_id" character varying(100),
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_executions" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_executions_job_id" ON "executions" ("job_id")`);
		await queryRunner.query(`CREATE INDEX "IDX_executions_status" ON "executions" ("status")`);
		await queryRunner.query(`CREATE INDEX "IDX_executions_started_at" ON "executions" ("started_at")`);
		await queryRunner.query(
			`ALTER TABLE "executions" ADD CONSTRAINT "FK_executions_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "executions" ADD CONSTRAINT "FK_executions_schedule_id" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);

		// execution_logs
		await queryRunner.query(`
			CREATE TABLE "execution_logs" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"execution_id" uuid NOT NULL,
				"log_level" "public"."log_level_enum" NOT NULL,
				"message" text NOT NULL,
				"context" jsonb NOT NULL DEFAULT '{}',
				"logged_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_execution_logs" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_execution_logs_execution_id" ON "execution_logs" ("execution_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_execution_logs_log_level" ON "execution_logs" ("log_level")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_execution_logs_logged_at" ON "execution_logs" ("logged_at")`
		);
		await queryRunner.query(
			`ALTER TABLE "execution_logs" ADD CONSTRAINT "FK_execution_logs_execution_id" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// recurring_jobs
		await queryRunner.query(`
			CREATE TABLE "recurring_jobs" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"name" character varying(200) NOT NULL,
				"pattern_type" character varying(50) NOT NULL,
				"pattern_config" jsonb NOT NULL,
				"template_job_id" uuid NOT NULL,
				"last_generated" TIMESTAMP,
				"next_generation" TIMESTAMP,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "PK_recurring_jobs" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_recurring_jobs_is_active" ON "recurring_jobs" ("is_active")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_recurring_jobs_next_generation" ON "recurring_jobs" ("next_generation")`
		);
		await queryRunner.query(
			`ALTER TABLE "recurring_jobs" ADD CONSTRAINT "FK_recurring_jobs_template_job_id" FOREIGN KEY ("template_job_id") REFERENCES "jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);

		// job_dependencies
		await queryRunner.query(`
			CREATE TABLE "job_dependencies" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"job_id" uuid NOT NULL,
				"depends_on_job_id" uuid NOT NULL,
				"dependency_type" "public"."dependency_type_enum" NOT NULL,
				"dependency_config" jsonb NOT NULL DEFAULT '{}',
				"created_at" TIMESTAMP NOT NULL DEFAULT now(),
				CONSTRAINT "UQ_job_dependencies_job_depends_type" UNIQUE ("job_id", "depends_on_job_id", "dependency_type"),
				CONSTRAINT "PK_job_dependencies" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_job_dependencies_job_id" ON "job_dependencies" ("job_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_job_dependencies_depends_on_job_id" ON "job_dependencies" ("depends_on_job_id")`
		);
		await queryRunner.query(
			`ALTER TABLE "job_dependencies" ADD CONSTRAINT "FK_job_dependencies_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_dependencies" ADD CONSTRAINT "FK_job_dependencies_depends_on_job_id" FOREIGN KEY ("depends_on_job_id") REFERENCES "jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop FKs and tables in reverse dependency order
		await queryRunner.query(
			`ALTER TABLE "job_dependencies" DROP CONSTRAINT "FK_job_dependencies_depends_on_job_id"`
		);
		await queryRunner.query(
			`ALTER TABLE "job_dependencies" DROP CONSTRAINT "FK_job_dependencies_job_id"`
		);
		await queryRunner.query(`DROP TABLE "job_dependencies"`);

		await queryRunner.query(
			`ALTER TABLE "recurring_jobs" DROP CONSTRAINT "FK_recurring_jobs_template_job_id"`
		);
		await queryRunner.query(`DROP TABLE "recurring_jobs"`);

		await queryRunner.query(
			`ALTER TABLE "execution_logs" DROP CONSTRAINT "FK_execution_logs_execution_id"`
		);
		await queryRunner.query(`DROP TABLE "execution_logs"`);

		await queryRunner.query(`ALTER TABLE "executions" DROP CONSTRAINT "FK_executions_schedule_id"`);
		await queryRunner.query(`ALTER TABLE "executions" DROP CONSTRAINT "FK_executions_job_id"`);
		await queryRunner.query(`DROP TABLE "executions"`);

		await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_job_id"`);
		await queryRunner.query(`DROP TABLE "schedules"`);

		await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_jobs_category_id"`);
		await queryRunner.query(`DROP TABLE "jobs"`);

		await queryRunner.query(`DROP TABLE "job_categories"`);

		await queryRunner.query(`DROP TYPE "public"."dependency_type_enum"`);
		await queryRunner.query(`DROP TYPE "public"."log_level_enum"`);
		await queryRunner.query(`DROP TYPE "public"."execution_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."schedule_type_enum"`);
		await queryRunner.query(`DROP TYPE "public"."priority_enum"`);
	}
}
