import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';
import { JobStatus, JobType } from '../enums';
import { Schedule } from './schedule.entity';
import { JobExecution } from './job-execution.entity';

@Entity('jobs')
@Index(['status', 'type'])
@Index(['createdAt'])
@Index(['priority', 'status'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  type: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  @Index()
  status: JobStatus;

  @Column({ type: 'simple-json' })
  payload: Record<string, any>;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ type: 'int', default: 3, name: 'max_retries' })
  maxRetries: number;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'simple-json', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'failed_at' })
  failedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true, name: 'error_details' })
  errorDetails: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'next_retry_at' })
  nextRetryAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => Schedule, (schedule) => schedule.job, { cascade: true })
  schedule: Schedule;

  @OneToMany(() => JobExecution, (execution) => execution.job, { cascade: true })
  executions: JobExecution[];

  // Helper methods
  canRetry(): boolean {
    return this.retryCount < this.maxRetries && this.status === JobStatus.FAILED;
  }

  isExecutable(): boolean {
    return [JobStatus.PENDING, JobStatus.RETRY].includes(this.status);
  }

  isPaused(): boolean {
    return this.status === JobStatus.PAUSED;
  }

  isCompleted(): boolean {
    return [JobStatus.COMPLETED, JobStatus.CANCELLED].includes(this.status);
  }

  isFailed(): boolean {
    return this.status === JobStatus.FAILED;
  }

  markAsRunning(): void {
    this.status = JobStatus.RUNNING;
    this.startedAt = new Date();
  }

  markAsCompleted(): void {
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
  }

  markAsFailed(error?: string, details?: Record<string, any>): void {
    this.status = JobStatus.FAILED;
    this.failedAt = new Date();
    this.errorMessage = error || null;
    this.errorDetails = details || null;
    this.retryCount += 1;

    if (this.canRetry()) {
      this.status = JobStatus.RETRY;
      this.nextRetryAt = this.calculateNextRetryTime();
    }
  }

  markAsPaused(): void {
    this.status = JobStatus.PAUSED;
  }

  markAsCancelled(): void {
    this.status = JobStatus.CANCELLED;
    this.completedAt = new Date();
  }

  reset(): void {
    this.status = JobStatus.PENDING;
    this.retryCount = 0;
    this.startedAt = null;
    this.completedAt = null;
    this.failedAt = null;
    this.errorMessage = null;
    this.errorDetails = null;
    this.nextRetryAt = null;
  }

  private calculateNextRetryTime(): Date {
    // Exponential backoff: 2^retryCount * 60 seconds
    const delayMinutes = Math.pow(2, this.retryCount) * 1;
    const delay = Math.min(delayMinutes * 60 * 1000, 24 * 60 * 60 * 1000); // Max 24 hours
    return new Date(Date.now() + delay);
  }

  getDuration(): number | null {
    if (!this.startedAt) return null;
    const endTime = this.completedAt || this.failedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  getProgress(): number {
    if (this.status === JobStatus.COMPLETED) return 100;
    if (this.status === JobStatus.FAILED || this.status === JobStatus.CANCELLED) return 0;
    if (this.status === JobStatus.RUNNING) return 50; // Could be enhanced with actual progress
    return 0;
  }
}
