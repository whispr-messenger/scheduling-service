import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
} from '@nestjs/terminus';
import { CustomHealthService } from '../services/health.service';
import { MetricsService, SystemMetrics } from '../services/metrics.service';
import { QueueService } from '@/modules/queues/services/queue.service';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';

@ApiTags('Monitoring')
@Controller('api/v1/monitoring')
@UseInterceptors(LoggingInterceptor)
export class MonitoringController {
  constructor(
    private readonly healthService: CustomHealthService,
    private readonly metricsService: MetricsService,
    private readonly queueService: QueueService,
  ) {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: 200,
    description: 'Health check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Service unhealthy' })
  async checkHealth(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get simple service status' })
  @ApiResponse({
    status: 200,
    description: 'Service status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  async getStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      service: 'whispr-scheduling-service',
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get comprehensive system metrics' })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        jobs: { type: 'object' },
        executions: { type: 'object' },
        queues: { type: 'object' },
        system: { type: 'object' },
      },
    },
  })
  async getMetrics(): Promise<SystemMetrics> {
    return this.metricsService.getSystemMetrics();
  }

  @Get('metrics/categories')
  @ApiOperation({ summary: 'Get metrics by job category' })
  @ApiResponse({
    status: 200,
    description: 'Category metrics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          totalJobs: { type: 'number' },
          executions24h: { type: 'number' },
          successRate: { type: 'number' },
        },
      },
    },
  })
  async getCategoryMetrics() {
    return this.metricsService.getJobCategoryMetrics();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          queueName: { type: 'string' },
          counts: { type: 'object' },
          jobs: { type: 'object' },
        },
      },
    },
  })
  async getQueueStats() {
    return this.queueService.getAllQueueStats();
  }

  @Get('queues/:queueName')
  @ApiOperation({ summary: 'Get specific queue statistics' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStatsByName(@Param('queueName') queueName: string) {
    return this.queueService.getQueueStats(queueName);
  }

  @Post('queues/:queueName/clean')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clean completed and failed jobs from queue' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiQuery({
    name: 'grace',
    required: false,
    type: 'number',
    description: 'Grace period in milliseconds (default: 5000)',
  })
  @ApiResponse({ status: 204, description: 'Queue cleaned successfully' })
  async cleanQueue(
    @Param('queueName') queueName: string,
    @Query('grace') grace?: number,
  ): Promise<void> {
    return this.queueService.cleanQueue(queueName, grace);
  }

  @Post('queues/:queueName/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Pause queue processing' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiResponse({ status: 204, description: 'Queue paused successfully' })
  async pauseQueue(@Param('queueName') queueName: string): Promise<void> {
    return this.queueService.pauseQueue(queueName);
  }

  @Post('queues/:queueName/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resume queue processing' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiResponse({ status: 204, description: 'Queue resumed successfully' })
  async resumeQueue(@Param('queueName') queueName: string): Promise<void> {
    return this.queueService.resumeQueue(queueName);
  }

  @Post('queues/:queueName/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs in queue' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs retried',
    schema: {
      type: 'object',
      properties: {
        retriedCount: { type: 'number' },
      },
    },
  })
  async retryFailedJobs(@Param('queueName') queueName: string) {
    const retriedCount = await this.queueService.retryFailedJobs(queueName);
    return { retriedCount };
  }

  @Get('jobs/:jobId/status')
  @ApiOperation({ summary: 'Get job status in queue' })
  @ApiParam({ name: 'jobId', description: 'Job ID', type: 'string' })
  @ApiQuery({
    name: 'queueName',
    required: false,
    description: 'Queue name to search in',
    enum: ['high-priority', 'medium-priority', 'low-priority'],
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Job not found in queue' })
  async getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('queueName') queueName?: string,
  ) {
    if (queueName) {
      return this.queueService.getJobStatus(queueName, jobId);
    }

    // Search in all queues if no specific queue provided
    const queueNames = ['high-priority', 'medium-priority', 'low-priority'];
    for (const name of queueNames) {
      const status = await this.queueService.getJobStatus(name, jobId);
      if (status) {
        return { queueName: name, ...status };
      }
    }

    return null;
  }
}