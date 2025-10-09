import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ScheduleStatus } from '../enums';
import { Job } from './job.entity';

@Entity('schedules')
@Index(['isActive', 'nextExecution'])
@Index(['cronExpression'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id' })
  jobId: string;

  @Column({ type: 'varchar', length: 100, name: 'cron_expression' })
  cronExpression: string;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @Column({ type: 'timestamp', nullable: true, name: 'start_at' })
  startAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'end_at' })
  endAt: Date | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  @Index()
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'last_execution' })
  lastExecution: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'next_execution' })
  @Index()
  nextExecution: Date | null;

  @Column({ type: 'int', default: 0, name: 'execution_count' })
  executionCount: number;

  @Column({ type: 'int', nullable: true, name: 'max_executions' })
  maxExecutions: number | null;

  @Column({ type: 'simple-json', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => Job, (job) => job.schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  // Helper methods
  isScheduleActive(): boolean {
    if (!this.isActive || this.status !== ScheduleStatus.ACTIVE) {
      return false;
    }

    const now = new Date();

    if (this.startAt && now < this.startAt) {
      return false;
    }

    if (this.endAt && now > this.endAt) {
      return false;
    }

    if (this.maxExecutions && this.executionCount >= this.maxExecutions) {
      return false;
    }

    return true;
  }

  shouldExecuteNow(): boolean {
    if (!this.isScheduleActive()) {
      return false;
    }

    const now = new Date();
    return Boolean(this.nextExecution && now >= this.nextExecution);
  }

  recordExecution(): void {
    this.lastExecution = new Date();
    this.executionCount += 1;

    // Check if we've reached max executions
    if (this.maxExecutions && this.executionCount >= this.maxExecutions) {
      this.status = ScheduleStatus.EXPIRED;
      this.isActive = false;
      this.nextExecution = null;
    }
  }

  pause(): void {
    this.status = ScheduleStatus.PAUSED;
    this.isActive = false;
  }

  resume(): void {
    if (this.status === ScheduleStatus.PAUSED) {
      this.status = ScheduleStatus.ACTIVE;
      this.isActive = true;
    }
  }

  deactivate(): void {
    this.status = ScheduleStatus.INACTIVE;
    this.isActive = false;
    this.nextExecution = null;
  }

  updateCronExpression(cronExpression: string): void {
    this.cronExpression = cronExpression;
    // Next execution would be recalculated by the scheduler service
  }

  updateTimezone(timezone: string): void {
    this.timezone = timezone;
    // Next execution would be recalculated by the scheduler service
  }

  setExecutionWindow(startAt?: Date, endAt?: Date): void {
    this.startAt = startAt || null;
    this.endAt = endAt || null;

    // Validate the schedule is still active
    if (!this.isScheduleActive()) {
      this.deactivate();
    }
  }

  setMaxExecutions(maxExecutions?: number): void {
    this.maxExecutions = maxExecutions || null;

    // Check if we've already exceeded the limit
    if (maxExecutions && this.executionCount >= maxExecutions) {
      this.status = ScheduleStatus.EXPIRED;
      this.isActive = false;
      this.nextExecution = null;
    }
  }

  getExecutionProgress(): number {
    if (!this.maxExecutions) return 0;
    return Math.min((this.executionCount / this.maxExecutions) * 100, 100);
  }

  getTimeUntilNextExecution(): number | null {
    if (!this.nextExecution) return null;
    const now = new Date();
    return Math.max(0, this.nextExecution.getTime() - now.getTime());
  }

  isExpired(): boolean {
    const now = new Date();
    return Boolean(
      this.status === ScheduleStatus.EXPIRED ||
        (this.endAt && now > this.endAt) ||
        (this.maxExecutions && this.executionCount >= this.maxExecutions),
    );
  }

  getRemainingExecutions(): number | null {
    if (!this.maxExecutions) return null;
    return Math.max(0, this.maxExecutions - this.executionCount);
  }
}
