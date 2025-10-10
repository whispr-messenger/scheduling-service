import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExecutionStatus } from '../enums';
import { Job } from './job.entity';

@Entity('job_executions')
@Index(['jobId', 'startedAt'])
@Index(['status', 'startedAt'])
@Index(['startedAt'])
export class JobExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id' })
  @Index()
  jobId: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.RUNNING,
  })
  @Index()
  status: ExecutionStatus;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs: number | null;

  @Column({ type: 'text', nullable: true, name: 'output' })
  output: string | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true, name: 'error_details' })
  errorDetails: Record<string, any> | null;

  @Column({ type: 'simple-json', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_id' })
  workerId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'queue_name' })
  queueName: string | null;

  @Column({ type: 'int', nullable: true })
  priority: number | null;

  @Column({ type: 'int', default: 0, name: 'retry_attempt' })
  retryAttempt: number;

  @Column({ type: 'simple-json', nullable: true, name: 'execution_context' })
  executionContext: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, (job) => job.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  // Helper methods
  markAsCompleted(output?: string): void {
    this.status = ExecutionStatus.COMPLETED;
    this.completedAt = new Date();
    this.durationMs = this.calculateDuration();
    if (output) {
      this.output = output;
    }
  }

  markAsFailed(error: string, details?: Record<string, any>): void {
    this.status = ExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.durationMs = this.calculateDuration();
    this.errorMessage = error;
    this.errorDetails = details || null;
  }

  markAsTimeout(): void {
    this.status = ExecutionStatus.TIMEOUT;
    this.completedAt = new Date();
    this.durationMs = this.calculateDuration();
    this.errorMessage = 'Execution timed out';
  }

  markAsCancelled(): void {
    this.status = ExecutionStatus.CANCELLED;
    this.completedAt = new Date();
    this.durationMs = this.calculateDuration();
  }

  private calculateDuration(): number {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  isRunning(): boolean {
    return this.status === ExecutionStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === ExecutionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return [ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT].includes(this.status);
  }

  isCancelled(): boolean {
    return this.status === ExecutionStatus.CANCELLED;
  }

  isFinished(): boolean {
    return [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.TIMEOUT,
      ExecutionStatus.CANCELLED,
    ].includes(this.status);
  }

  getDurationInSeconds(): number {
    return this.durationMs ? Math.round(this.durationMs / 1000) : 0;
  }

  getDurationFormatted(): string {
    if (!this.durationMs) return '0s';

    const seconds = Math.floor(this.durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getElapsedTime(): number {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  setExecutionContext(context: Record<string, any>): void {
    this.executionContext = {
      ...this.executionContext,
      ...context,
    };
  }

  addMetadata(key: string, value: any): void {
    this.metadata = {
      ...this.metadata,
      [key]: value,
    };
  }

  setWorkerInfo(workerId: string, queueName: string): void {
    this.workerId = workerId;
    this.queueName = queueName;
  }

  incrementRetryAttempt(): void {
    this.retryAttempt += 1;
  }

  getSuccessRate(): number {
    // This would typically be calculated at the job level across all executions
    return this.isCompleted() ? 100 : 0;
  }

  getPerformanceMetrics(): {
    duration: number;
    status: ExecutionStatus;
    retryAttempt: number;
    workerId: string | null;
    queueName: string | null;
  } {
    return {
      duration: this.durationMs || 0,
      status: this.status,
      retryAttempt: this.retryAttempt,
      workerId: this.workerId,
      queueName: this.queueName,
    };
  }
}
