import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601WithOffset } from '@/common/decorators/is-iso8601-with-offset.decorator';

export class CreateScheduledMessageDto {
	@ApiProperty({
		description: 'ID of the conversation to send the message to',
		example: 'b2c3d4e5-6789-abcd-ef01-23456789abcd',
	})
	@IsUUID()
	@IsNotEmpty()
	conversationId: string;

	@ApiProperty({
		description: 'Message content',
		example: 'Hello, this is a scheduled message!',
		maxLength: 4000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(4000)
	content: string;

	@ApiPropertyOptional({
		description: 'Additional metadata for the message',
		example: { type: 'reminder', priority: 'high' },
	})
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;

	@ApiProperty({
		description:
			'When the message should be sent (ISO 8601 with explicit timezone offset, must be in the future)',
		example: '2026-04-15T10:00:00+02:00',
	})
	@IsISO8601WithOffset()
	@IsNotEmpty()
	scheduledAt: string;
}
