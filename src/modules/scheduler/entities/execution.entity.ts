import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	OneToMany,
	JoinColumn,
	Index,
} from 'typeorm';
import { ExecutionStatus } from './enums';
import { Job } from './job.entity';
import { Schedule } from './schedule.entity';
import { ExecutionLog } from './execution-log.entity';

@Entity('executions')
@Index(['jobId'])
@Index(['status'])
@Index(['startedAt'])
export class Execution {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'uuid', name: 'job_id' })
	jobId: string;

	@Column({ type: 'uuid', nullable: true, name: 'schedule_id' })
	scheduleId: string | null;

	@Column({ type: 'enum', enum: ExecutionStatus })
	status: ExecutionStatus;

	@Column({ type: 'timestamp', name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
	startedAt: Date;

	@Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
	completedAt: Date | null;

	@Column({ type: 'timestamp', nullable: true, name: 'failed_at' })
	failedAt: Date | null;

	@Column({ type: 'int', default: 1, name: 'attempt_number' })
	attemptNumber: number;

	@Column({ type: 'jsonb', nullable: true, name: 'result_data' })
	resultData: Record<string, any> | null;

	@Column({ type: 'jsonb', nullable: true, name: 'error_data' })
	errorData: Record<string, any> | null;

	@Column({ type: 'int', nullable: true, name: 'duration_ms' })
	durationMs: number | null;

	@Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_id' })
	workerId: string | null;

	@Column({ type: 'varchar', length: 100, nullable: true, name: 'correlation_id' })
	correlationId: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	// Relations
	@ManyToOne(() => Job, (job) => job.executions)
	@JoinColumn({ name: 'job_id' })
	job: Job;

	@ManyToOne(() => Schedule, (schedule) => schedule.executions, { nullable: true })
	@JoinColumn({ name: 'schedule_id' })
	schedule: Schedule | null;

	@OneToMany(() => ExecutionLog, (log) => log.execution, { cascade: true })
	logs: ExecutionLog[];
}
