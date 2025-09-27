import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { QueueService, QueueJobData, QueueOptions } from './queue.service';
import { QueueName } from './enums';

@ApiTags('queues')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  async getQueueStats() {
    return this.queueService.getQueueStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get queue health status' })
  @ApiResponse({ status: 200, description: 'Queue health status retrieved' })
  async getQueueHealth() {
    return this.queueService.getQueueHealth();
  }

  @Get('jobs/failed')
  @ApiOperation({ summary: 'Get failed jobs with details' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Failed jobs retrieved' })
  async getFailedJobs(@Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50) {
    return this.queueService.getFailedJobs(limit);
  }

  @Get('jobs/:state')
  @ApiOperation({ summary: 'Get jobs by state' })
  @ApiParam({ name: 'state', description: 'Job state' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Jobs retrieved by state' })
  async getJobsByState(
    @Param('state') state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset: number = 0,
  ) {
    return this.queueService.getJobsByState(state, limit, offset);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Add job to queue' })
  @ApiResponse({ status: 201, description: 'Job added to queue' })
  @ApiResponse({ status: 400, description: 'Invalid job data' })
  async addJob(
    @Body(ValidationPipe) body: { data: QueueJobData; options?: QueueOptions },
  ) {
    return this.queueService.addJob(body.data, body.options);
  }

  @Delete('jobs/:jobId')
  @ApiOperation({ summary: 'Remove job from all queues' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job removed from queues' })
  async removeJob(@Param('jobId') jobId: string) {
    await this.queueService.removeJob(jobId);
    return { message: 'Job removed from all queues' };
  }

  @Post('/:queueName/pause')
  @ApiOperation({ summary: 'Pause a specific queue' })
  @ApiParam({ name: 'queueName', enum: QueueName })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  async pauseQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.pauseQueue(queueName);
    return { message: `Queue ${queueName} paused` };
  }

  @Post('/:queueName/resume')
  @ApiOperation({ summary: 'Resume a specific queue' })
  @ApiParam({ name: 'queueName', enum: QueueName })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  async resumeQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.resumeQueue(queueName);
    return { message: `Queue ${queueName} resumed` };
  }

  @Post('clean')
  @ApiOperation({ summary: 'Clean old jobs from queues' })
  @ApiResponse({ status: 200, description: 'Queues cleaned' })
  async cleanQueues(
    @Body(ValidationPipe)
    body: {
      status: 'completed' | 'failed';
      olderThan: number;
    },
  ) {
    await this.queueService.cleanQueue(body.status, body.olderThan);
    return { message: `Cleaned ${body.status} jobs older than ${body.olderThan}ms` };
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Retry failed jobs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Failed jobs retried' })
  async retryFailedJobs(@Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10) {
    const retriedCount = await this.queueService.retryFailedJobs(limit);
    return { message: `Retried ${retriedCount} failed jobs` };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get job details by ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job details retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.queueService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress(),
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    };
  }
}