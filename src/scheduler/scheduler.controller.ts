import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  ValidationPipe,
  HttpStatus,
  HttpException,
  DefaultValuePipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { SchedulerService } from './scheduler.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { JobStatus } from './enums';

@ApiTags('scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) { }

  @Post('jobs')
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createJob(@Body(ValidationPipe) createJobDto: CreateJobDto) {
    return this.schedulerService.createJob(createJobDto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get jobs with filtering and pagination' })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
  ) {
    let jobs;

    if (status && type) {
      // Filter by both status and type
      jobs = await this.schedulerService.getJobsByStatus(status, limit);
      jobs = jobs.filter((job) => job.type === type);
    } else if (status) {
      jobs = await this.schedulerService.getJobsByStatus(status, limit);
    } else if (type) {
      // Filter by type only - get all pending jobs and filter by type
      jobs = await this.schedulerService.getJobsByStatus(JobStatus.PENDING, limit);
      jobs = jobs.filter((job) => job.type === type);
    } else {
      // No filters - return all pending jobs with pagination
      jobs = await this.schedulerService.getJobsByStatus(JobStatus.PENDING, limit);
    }

    return {
      jobs,
      total: jobs.length,
      limit,
      offset,
    };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job found' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.schedulerService.findJobById(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Put('jobs/:id')
  @ApiOperation({ summary: 'Update job' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job updated successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateJobDto: UpdateJobDto,
  ) {
    return this.schedulerService.updateJob(id, updateJobDto);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Delete job' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async deleteJob(@Param('id', ParseUUIDPipe) id: string) {
    await this.schedulerService.deleteJob(id);
    return { message: 'Job deleted successfully' };
  }

  @Post('jobs/:id/schedule')
  @ApiOperation({ summary: 'Schedule a job with cron expression' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 201, description: 'Job scheduled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async scheduleJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) scheduleDto: CreateScheduleDto,
  ) {
    return this.schedulerService.scheduleJob(id, scheduleDto);
  }

  @Post('jobs/:id/execute')
  @ApiOperation({ summary: 'Execute job immediately' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 201, description: 'Job execution started' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job not executable' })
  async executeJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.executeJob(id);
  }

  @Get('jobs/:id/executions')
  @ApiOperation({ summary: 'Get job execution history' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job executions retrieved' })
  async getJobExecutions(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.getJobExecutions(id);
  }

  @Post('jobs/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job paused successfully' })
  async pauseJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.pauseJob(id);
  }

  @Post('jobs/:id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job resumed successfully' })
  async resumeJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.resumeJob(id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  async cancelJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.cancelJob(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry failed job' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job retry initiated' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  async retryJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.retryJob(id);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get job statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics() {
    return this.schedulerService.getJobStatistics();
  }
}
