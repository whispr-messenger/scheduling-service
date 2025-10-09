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
import { ScheduleType } from './enums';
import { Job } from './job.entity';
import { Execution } from './execution.entity';

@Entity('schedules')
@Index(['isActive'])
@Index(['scheduleType'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id' })
  jobId: string;

  @Column({ type: 'enum', enum: ScheduleType, name: 'schedule_type' })
  scheduleType: ScheduleType;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'cron_expression' })
  cronExpression: string | null;

  @Column({ type: 'int', nullable: true, name: 'interval_seconds' })
  intervalSeconds: number | null;

  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @Column({ type: 'timestamp', nullable: true, name: 'starts_at' })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'ends_at' })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, (job) => job.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @OneToMany(() => Execution, (execution) => execution.schedule)
  executions: Execution[];
}
