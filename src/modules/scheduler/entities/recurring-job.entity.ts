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
import { Job } from './job.entity';

@Entity('recurring_jobs')
@Index(['isActive'])
@Index(['nextGeneration'])
export class RecurringJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 50, name: 'pattern_type' })
  patternType: string;

  @Column({ type: 'jsonb', name: 'pattern_config' })
  patternConfig: Record<string, any>;

  @Column({ type: 'uuid', name: 'template_job_id' })
  templateJobId: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_generated' })
  lastGenerated: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'next_generation' })
  nextGeneration: Date | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, (job) => job.recurringPatterns)
  @JoinColumn({ name: 'template_job_id' })
  templateJob: Job;
}
