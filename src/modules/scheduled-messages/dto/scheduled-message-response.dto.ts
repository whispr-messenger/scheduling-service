import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduledMessageStatus } from '../entities/scheduled-message.entity';

export class ScheduledMessageResponseDto {
	@ApiProperty({
		description: 'Scheduled message ID',
		example: 'e7f8a9b0-1234-5678-9abc-def012345678',
	})
	id: string;

	@ApiProperty({
		description: 'User ID who scheduled the message',
		example: 'a1b2c3d4-5678-9abc-def0-123456789abc',
	})
	userId: string;

	@ApiProperty({
		description: 'Target conversation ID',
		example: 'b2c3d4e5-6789-abcd-ef01-23456789abcd',
	})
	conversationId: string;

	@ApiProperty({
		description: 'Message content',
		example: 'Hello, this is a scheduled message!',
	})
	content: string;

	@ApiPropertyOptional({
		description: 'Additional metadata',
		example: { type: 'reminder', priority: 'high' },
	})
	metadata?: Record<string, any> | null;

	@ApiProperty({
		description: 'When the message is scheduled to be sent',
		example: '2026-04-15T10:00:00Z',
	})
	scheduledAt: Date;

	@ApiProperty({
		description: 'Current status of the scheduled message',
		enum: ScheduledMessageStatus,
		example: ScheduledMessageStatus.PENDING,
	})
	status: ScheduledMessageStatus;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2026-03-13T10:00:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2026-03-13T10:00:00Z',
	})
	updatedAt: Date;
}
