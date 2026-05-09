import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
	})
	@IsString()
	@IsNotEmpty()
	content: string;

	@ApiPropertyOptional({
		description: 'Additional metadata for the message',
		example: { type: 'reminder', priority: 'high' },
	})
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;

	@ApiProperty({
		description: 'When the message should be sent (ISO 8601 format, must be in the future)',
		example: '2026-04-15T10:00:00Z',
	})
	@IsDateString()
	@IsNotEmpty()
	scheduledAt: string;
}
