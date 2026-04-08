import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	ParseUUIDPipe,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiQuery,
	ApiBearerAuth,
	ApiBody,
} from '@nestjs/swagger';
import { ScheduledMessagesService } from '../services/scheduled-messages.service';
import { CreateScheduledMessageDto } from '../dto/create-scheduled-message.dto';
import { UpdateScheduledMessageDto } from '../dto/update-scheduled-message.dto';
import { ScheduledMessageResponseDto } from '../dto/scheduled-message-response.dto';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';

@ApiTags('Scheduled Messages')
@ApiBearerAuth()
@Controller('api/scheduled-messages')
@UseInterceptors(LoggingInterceptor)
export class ScheduledMessagesController {
	constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: 'Create a scheduled message' })
	@ApiBody({ type: CreateScheduledMessageDto })
	@ApiResponse({
		status: 201,
		description: 'Scheduled message created successfully',
		type: ScheduledMessageResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	async create(@Body() dto: CreateScheduledMessageDto): Promise<ScheduledMessageResponseDto> {
		return this.scheduledMessagesService.create(dto);
	}

	@Get()
	@ApiOperation({ summary: "List user's scheduled messages" })
	@ApiQuery({
		name: 'userId',
		required: true,
		type: 'string',
		description: 'User ID to filter scheduled messages',
	})
	@ApiResponse({
		status: 200,
		description: 'Scheduled messages retrieved successfully',
		type: [ScheduledMessageResponseDto],
	})
	async findAll(@Query('userId', ParseUUIDPipe) userId: string): Promise<ScheduledMessageResponseDto[]> {
		return this.scheduledMessagesService.findAllByUser(userId);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a scheduled message by ID' })
	@ApiParam({ name: 'id', description: 'Scheduled message ID', type: 'string' })
	@ApiQuery({
		name: 'userId',
		required: true,
		type: 'string',
		description: 'User ID for ownership validation',
	})
	@ApiResponse({
		status: 200,
		description: 'Scheduled message retrieved successfully',
		type: ScheduledMessageResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Scheduled message not found' })
	async findOne(
		@Param('id', ParseUUIDPipe) id: string,
		@Query('userId', ParseUUIDPipe) userId: string
	): Promise<ScheduledMessageResponseDto> {
		return this.scheduledMessagesService.findOne(id, userId);
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update a scheduled message (only if still pending)' })
	@ApiParam({ name: 'id', description: 'Scheduled message ID', type: 'string' })
	@ApiQuery({
		name: 'userId',
		required: true,
		type: 'string',
		description: 'User ID for ownership validation',
	})
	@ApiBody({ type: UpdateScheduledMessageDto })
	@ApiResponse({
		status: 200,
		description: 'Scheduled message updated successfully',
		type: ScheduledMessageResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Cannot update non-pending message' })
	@ApiResponse({ status: 404, description: 'Scheduled message not found' })
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Query('userId', ParseUUIDPipe) userId: string,
		@Body() dto: UpdateScheduledMessageDto
	): Promise<ScheduledMessageResponseDto> {
		return this.scheduledMessagesService.update(id, userId, dto);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Cancel a scheduled message' })
	@ApiParam({ name: 'id', description: 'Scheduled message ID', type: 'string' })
	@ApiQuery({
		name: 'userId',
		required: true,
		type: 'string',
		description: 'User ID for ownership validation',
	})
	@ApiResponse({ status: 204, description: 'Scheduled message cancelled successfully' })
	@ApiResponse({ status: 400, description: 'Cannot cancel non-pending message' })
	@ApiResponse({ status: 404, description: 'Scheduled message not found' })
	async cancel(
		@Param('id', ParseUUIDPipe) id: string,
		@Query('userId', ParseUUIDPipe) userId: string
	): Promise<void> {
		return this.scheduledMessagesService.cancel(id, userId);
	}
}
