import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LogLevel } from './enums';
import { Execution } from './execution.entity';

@Entity('execution_logs')
@Index(['executionId'])
@Index(['logLevel'])
@Index(['loggedAt'])
export class ExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'execution_id' })
  executionId: string;

  @Column({ type: 'enum', enum: LogLevel, name: 'log_level' })
  logLevel: LogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, any>;

  @CreateDateColumn({ name: 'logged_at', type: 'timestamp' })
  loggedAt: Date;

  // Relations
  @ManyToOne(() => Execution, (execution) => execution.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;
}
