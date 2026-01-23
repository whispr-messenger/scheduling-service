import { DataSource } from 'typeorm';
import { Job } from '../../scheduler/entities/job.entity';
import { Schedule } from '../../scheduler/entities/schedule.entity';
import { Execution } from '../../scheduler/entities/execution.entity';
import { JobCategory } from '../../scheduler/entities/job-category.entity';
import { ExecutionLog } from '../../scheduler/entities/execution-log.entity';
import { RecurringJob } from '../../scheduler/entities/recurring-job.entity';
import { JobDependency } from '../../scheduler/entities/job-dependency.entity';

const ENTITIES = [Job, Schedule, Execution, JobCategory, ExecutionLog, RecurringJob, JobDependency];

const DEFAULT_POSTGRES_PORT = 5432;

/**
 * DataSource configuration for TypeORM CLI migrations
 * This file is used by TypeORM CLI commands (migration:generate, migration:run, etc.)
 */
export default new DataSource({
	type: 'postgres',
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || String(DEFAULT_POSTGRES_PORT), 10),
	username: process.env.DB_USERNAME || 'postgres',
	password: process.env.DB_PASSWORD || 'password',
	database: process.env.DB_NAME || 'scheduling_service',
	entities: ENTITIES,
	migrations: [__dirname + '/*{.ts,.js}'],
	logging: process.env.DB_LOGGING === 'true',
	synchronize: false, // Never use synchronize in migrations
});
