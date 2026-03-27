import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduledMessageDto {
	@ApiPropertyOptional({
		description: 'Updated message content',
		example: 'Updated scheduled message content',
	})
	@IsOptional()
	@IsString()
	content?: string;

	@ApiPropertyOptional({
		description: 'Updated metadata',
		example: { type: 'reminder', priority: 'low' },
	})
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;

	@ApiPropertyOptional({
		description: 'Updated scheduled time (ISO 8601 format, must be in the future)',
		example: '2026-04-20T14:00:00Z',
	})
	@IsOptional()
	@IsDateString()
	scheduledAt?: string;
}
