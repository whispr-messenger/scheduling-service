import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ScheduledMessageStatus {
	PENDING = 'pending',
	SENT = 'sent',
	CANCELLED = 'cancelled',
	FAILED = 'failed',
}

@Entity('scheduled_messages')
@Index(['userId'])
@Index(['status', 'scheduledAt'])
@Index(['conversationId'])
export class ScheduledMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	@Column({ type: 'uuid', name: 'conversation_id' })
	conversationId: string;

	@Column({ type: 'text' })
	content: string;

	@Column({ type: 'jsonb', nullable: true, default: null })
	metadata: Record<string, any> | null;

	@Column({ type: 'timestamp', name: 'scheduled_at' })
	scheduledAt: Date;

	@Column({
		type: 'enum',
		enum: ScheduledMessageStatus,
		default: ScheduledMessageStatus.PENDING,
	})
	status: ScheduledMessageStatus;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
