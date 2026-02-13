import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	OneToMany,
	JoinColumn,
	Index,
} from 'typeorm';
import { Priority } from './enums';
import { JobCategory } from './job-category.entity';
import { Schedule } from './schedule.entity';
import { Execution } from './execution.entity';
import { JobDependency } from './job-dependency.entity';
import { RecurringJob } from './recurring-job.entity';

@Entity('jobs')
@Index(['isActive'])
@Index(['priority'])
@Index(['createdAt'])
export class Job {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 200 })
	name: string;

	@Column({ type: 'text', nullable: true })
	description: string | null;

	@Column({ type: 'uuid', name: 'category_id' })
	categoryId: string;

	@Column({ type: 'varchar', length: 100, name: 'target_service' })
	targetService: string;

	@Column({ type: 'varchar', length: 100, name: 'target_method' })
	targetMethod: string;

	@Column({ type: 'jsonb', default: {} })
	payload: Record<string, any>;

	@Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
	priority: Priority;

	@Column({ type: 'int', default: 3, name: 'max_retries' })
	maxRetries: number;

	@Column({ type: 'int', default: 300, name: 'timeout_seconds' })
	timeoutSeconds: number;

	@Column({ type: 'boolean', default: true, name: 'is_active' })
	isActive: boolean;

	@Column({ type: 'uuid', nullable: true, name: 'created_by' })
	createdBy: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;

	@Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
	deletedAt: Date | null;

	// Relations
	@ManyToOne(() => JobCategory, (category) => category.jobs)
	@JoinColumn({ name: 'category_id' })
	category: JobCategory;

	@OneToMany(() => Schedule, (schedule) => schedule.job, { cascade: true })
	schedules: Schedule[];

	@OneToMany(() => Execution, (execution) => execution.job, { cascade: true })
	executions: Execution[];

	@OneToMany(() => JobDependency, (dependency) => dependency.job, { cascade: true })
	dependencies: JobDependency[];

	@OneToMany(() => JobDependency, (dependency) => dependency.dependsOnJob, { cascade: true })
	dependedOnBy: JobDependency[];

	@OneToMany(() => RecurringJob, (recurring) => recurring.templateJob, { cascade: true })
	recurringPatterns: RecurringJob[];
}
