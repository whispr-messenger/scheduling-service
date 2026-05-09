import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bascule la FK jobs.category_id de NO ACTION vers SET NULL et rend la
 * colonne nullable. Sans ca, supprimer une JobCategory cassait la contrainte
 * FK et orphelinait les jobs lies. Avec SET NULL on garde les jobs (audit
 * trail) et categoryId passe a NULL automatiquement.
 */
export class JobsCategoryFkSetNull1746900000000 implements MigrationInterface {
	name = 'JobsCategoryFkSetNull1746900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_jobs_category_id"`);
		await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "category_id" DROP NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "jobs" ADD CONSTRAINT "FK_jobs_category_id" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_jobs_category_id"`);
		// Pour revenir a NOT NULL il faut d'abord traiter les eventuels NULL
		// generes par le SET NULL (sinon ALTER echoue).
		await queryRunner.query(`DELETE FROM "jobs" WHERE "category_id" IS NULL`);
		await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "category_id" SET NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "jobs" ADD CONSTRAINT "FK_jobs_category_id" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
