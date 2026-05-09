import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ScheduledMessageStatus {
	PENDING = 'pending',
	// Etat intermediaire pose atomiquement avant d'envoyer le message.
	// Empeche un autre pod de retraiter le meme enregistrement si notre lock
	// Redis expire en cours de boucle (cf processDueMessages).
	PROCESSING = 'processing',
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

	// timestamptz : on stocke l'instant absolu UTC. Le DTO impose un offset
	// timezone explicite cote API (cf is-iso8601-with-offset.decorator), donc
	// `new Date(dto.scheduledAt)` produit toujours le bon instant.
	@Column({ type: 'timestamptz', name: 'scheduled_at' })
	scheduledAt: Date;

	@Column({
		type: 'enum',
		enum: ScheduledMessageStatus,
		default: ScheduledMessageStatus.PENDING,
	})
	status: ScheduledMessageStatus;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt: Date;
}
