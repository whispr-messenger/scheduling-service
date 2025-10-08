/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
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
import { SchedulerService } from '../services/scheduler.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { ScheduleJobDto } from '../dto/schedule-job.dto';
import { JobResponseDto, ScheduleResponseDto, ExecutionResponseDto } from '../dto/job-response.dto';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';

@ApiTags('Scheduler')
@Controller('api/v1/jobs')
@UseInterceptors(LoggingInterceptor)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job' })
  @ApiBody({ type: CreateJobDto })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Job category not found' })
  async createJob(
    @Body(new ValidationPipe({ transform: true })) createJobDto: CreateJobDto,
  ): Promise<JobResponseDto> {
    return this.schedulerService.createJob(createJobDto);
  }

  @Post(':jobId/schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a job for execution' })
  @ApiParam({ name: 'jobId', description: 'Job ID', type: 'string' })
  @ApiBody({ type: ScheduleJobDto })
  @ApiResponse({
    status: 201,
    description: 'Job scheduled successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid schedule configuration' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async scheduleJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body(new ValidationPipe({ transform: true })) scheduleJobDto: ScheduleJobDto,
  ): Promise<ScheduleResponseDto> {
    // Ensure jobId matches the one in the URL
    scheduleJobDto.jobId = jobId;

    // Validate the DTO
    const validationErrors = scheduleJobDto.validate();
    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    return this.schedulerService.scheduleJob(scheduleJobDto);
  }

  @Post(':jobId/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Execute a job immediately' })
  @ApiParam({ name: 'jobId', description: 'Job ID', type: 'string' })
  @ApiResponse({
    status: 202,
    description: 'Job execution started',
    type: ExecutionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async executeJob(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<ExecutionResponseDto> {
    return this.schedulerService.executeJob(jobId);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get job details by ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<JobResponseDto> {
    return this.schedulerService.getJob(jobId);
  }

  @Get(':jobId/executions')
  @ApiOperation({ summary: 'Get job execution history' })
  @ApiParam({ name: 'jobId', description: 'Job ID', type: 'string' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Number of executions to return',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: 'number',
    description: 'Number of executions to skip',
  })
  @ApiResponse({
    status: 200,
    description: 'Job executions retrieved successfully',
    type: [ExecutionResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobExecutions(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ExecutionResponseDto[]> {
    return this.schedulerService.getJobExecutions(jobId, limit || 50, offset || 0);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiQuery({ name: 'jobId', required: false, type: 'string', description: 'Filter by job ID' })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    type: [ScheduleResponseDto],
  })
  async getSchedules(@Query('jobId') jobId?: string): Promise<ScheduleResponseDto[]> {
    if (jobId) {
      // Validate UUID format
      try {
        new ParseUUIDPipe().transform(jobId, { type: 'query' });
      } catch {
        throw new BadRequestException('Invalid jobId format');
      }
    }

    return this.schedulerService.getSchedules(jobId);
  }

  @Delete('schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a scheduled job' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID', type: 'string' })
  @ApiResponse({ status: 204, description: 'Schedule cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async cancelSchedule(@Param('scheduleId', ParseUUIDPipe) scheduleId: string): Promise<void> {
    return this.schedulerService.cancelSchedule(scheduleId);
  }
}
