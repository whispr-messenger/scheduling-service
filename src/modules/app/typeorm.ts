import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from '../scheduler/entities/job.entity';
import { Schedule } from '../scheduler/entities/schedule.entity';
import { Execution } from '../scheduler/entities/execution.entity';
import { JobCategory } from '../scheduler/entities/job-category.entity';
import { ExecutionLog } from '../scheduler/entities/execution-log.entity';
import { RecurringJob } from '../scheduler/entities/recurring-job.entity';
import { JobDependency } from '../scheduler/entities/job-dependency.entity';
import { ScheduledMessage } from '../scheduled-messages/entities/scheduled-message.entity';
import { DataSourceOptions } from 'typeorm';
import { InitialSchema1743070800000 } from './migrations/1743070800000-InitialSchema';
import { AddScheduledMessages1743070800001 } from './migrations/1743070800001-AddScheduledMessages';

// Register new TypeORM entities here
const ENTITIES = [
	Job,
	Schedule,
	Execution,
	JobCategory,
	ExecutionLog,
	RecurringJob,
	JobDependency,
	ScheduledMessage,
];

const DEFAULT_POSTGRES_PORT = 5432;

interface DatabaseConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
}

/**
 * Parses a database connection URL into config components
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
	const parsed = new URL(url);
	return {
		host: parsed.hostname,
		port: parseInt(parsed.port, 10) || DEFAULT_POSTGRES_PORT,
		username: parsed.username,
		password: parsed.password,
		database: parsed.pathname.slice(1),
	};
}

/**
 * Retrieves database configuration from individual environment variables
 */
function getEnvDatabaseConfig(configService: ConfigService): DatabaseConfig {
	return {
		host: configService.get('DB_HOST', 'localhost'),
		port: configService.get('DB_PORT', DEFAULT_POSTGRES_PORT),
		username: configService.get('DB_USERNAME', 'postgres'),
		password: configService.get('DB_PASSWORD', 'password'),
		database: configService.get('DB_NAME', 'scheduling_service'),
	};
}

function getDataSourceOptions(configService: ConfigService): DataSourceOptions {
	// https://typeorm.io/docs/data-source/data-source-options/
	return {
		// RDBMS type. You must specify what database engine you use
		type: 'postgres',
		// Entities, or Entity Schemas, to be loaded and used for this data source.
		entities: ENTITIES,
		// Indicates if logging is enabled or not. If set to true then query and error logging will be enabled.
		logging: configService.get('DB_LOGGING', 'false') === 'true',
		// Migrations to be loaded and used for this data source
		// Explicit path (no glob) avoids DirectoryExportedClassesLoader infinite recursion (stack overflow)
		migrations: [InitialSchema1743070800000, AddScheduledMessages1743070800001],
		// Indicates if migrations should be auto-run on every application launch.
		migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'false') === 'true',
		// Indicates if database schema should be auto created on every application launch.
		// Be careful with this option and don't use this in production - otherwise you can lose production data.
		synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
	};
}

/**
 * Factory function to create TypeORM configuration based on environment
 */
export async function typeOrmModuleOptionsFactory(
	configService: ConfigService
): Promise<TypeOrmModuleOptions> {
	const databaseUrl = configService.get('DB_URL');
	const databaseConfig = databaseUrl ? parseDatabaseUrl(databaseUrl) : getEnvDatabaseConfig(configService);

	const dataSourceOptions: DataSourceOptions = getDataSourceOptions(configService);

	return {
		...databaseConfig,
		...dataSourceOptions,
	} as TypeOrmModuleOptions;
}
