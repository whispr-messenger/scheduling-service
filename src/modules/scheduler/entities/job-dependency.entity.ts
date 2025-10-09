import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { DependencyType } from './enums';
import { Job } from './job.entity';

@Entity('job_dependencies')
@Unique(['jobId', 'dependsOnJobId', 'dependencyType'])
@Index(['jobId'])
@Index(['dependsOnJobId'])
export class JobDependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id' })
  jobId: string;

  @Column({ type: 'uuid', name: 'depends_on_job_id' })
  dependsOnJobId: string;

  @Column({ type: 'enum', enum: DependencyType, name: 'dependency_type' })
  dependencyType: DependencyType;

  @Column({ type: 'jsonb', default: {}, name: 'dependency_config' })
  dependencyConfig: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Job, (job) => job.dependencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Job, (job) => job.dependedOnBy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'depends_on_job_id' })
  dependsOnJob: Job;
}
