import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601WithOffset } from '@/common/decorators/is-iso8601-with-offset.decorator';

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
		description: 'Updated scheduled time (ISO 8601 with explicit timezone offset, must be in the future)',
		example: '2026-04-20T14:00:00+02:00',
	})
	@IsOptional()
	@IsISO8601WithOffset()
	scheduledAt?: string;
}
