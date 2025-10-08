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
  ValidationPipe,
  HttpStatus,
  HttpException,
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
  constructor(private readonly schedulerService: SchedulerService) {}

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
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    if (status) {
      const jobs = await this.schedulerService.getJobsByStatus(status, limit);
      return {
        jobs,
        total: jobs.length,
        limit,
        offset,
      };
    }

    // For now, return all jobs with basic pagination
    // In a real implementation, you'd add proper pagination to the service
    const jobs = await this.schedulerService.getJobsByStatus(JobStatus.PENDING, limit);
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
  @ApiOperation({ summary: 'Pause job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job paused successfully' })
  async pauseJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.pauseJob(id);
  }

  @Post('jobs/:id/resume')
  @ApiOperation({ summary: 'Resume job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job resumed successfully' })
  async resumeJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.resumeJob(id);
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: 'Cancel job execution' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  async cancelJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulerService.cancelJob(id);
  }

  @Post('jobs/:id/retry')
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
