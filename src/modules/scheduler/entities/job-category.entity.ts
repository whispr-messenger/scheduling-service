import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Priority } from './enums';
import { Job } from './job.entity';

@Entity('job_categories')
@Index(['isActive'])
export class JobCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: Priority,
    default: Priority.MEDIUM,
    name: 'default_priority',
  })
  defaultPriority: Priority;

  @Column({ type: 'int', default: 300, name: 'default_timeout' })
  defaultTimeout: number;

  @Column({ type: 'int', default: 3, name: 'default_max_retries' })
  defaultMaxRetries: number;

  @Column({ type: 'jsonb', default: {} })
  configuration: Record<string, any>;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Job, (job) => job.category)
  jobs: Job[];
}
