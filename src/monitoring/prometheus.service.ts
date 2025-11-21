import { Injectable, Logger } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);
  public readonly register: Registry;

  // Job metrics
  public readonly jobsCreated: Counter;
  public readonly jobsCompleted: Counter;
  public readonly jobsFailed: Counter;
  public readonly jobsCancelled: Counter;
  public readonly jobDuration: Histogram;

  // Queue metrics
  public readonly queueSize: Gauge;
  public readonly queueWaitTime: Histogram;
  public readonly activeJobs: Gauge;
  public readonly completedJobs: Gauge;
  public readonly failedJobs: Gauge;

  // Execution metrics
  public readonly executionAttempts: Histogram;
  public readonly executionRetries: Counter;

  // System metrics
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsTotal: Counter;

  constructor() {
    this.register = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.register });

    // Job lifecycle metrics
    this.jobsCreated = new Counter({
      name: 'scheduler_jobs_created_total',
      help: 'Total number of jobs created',
      labelNames: ['category', 'priority', 'target_service'],
      registers: [this.register],
    });

    this.jobsCompleted = new Counter({
      name: 'scheduler_jobs_completed_total',
      help: 'Total number of jobs completed successfully',
      labelNames: ['category', 'target_service'],
      registers: [this.register],
    });

    this.jobsFailed = new Counter({
      name: 'scheduler_jobs_failed_total',
      help: 'Total number of jobs that failed',
      labelNames: ['category', 'target_service', 'error_type'],
      registers: [this.register],
    });

    this.jobsCancelled = new Counter({
      name: 'scheduler_jobs_cancelled_total',
      help: 'Total number of jobs cancelled',
      labelNames: ['category'],
      registers: [this.register],
    });

    this.jobDuration = new Histogram({
      name: 'scheduler_job_duration_seconds',
      help: 'Job execution duration in seconds',
      labelNames: ['category', 'target_service', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.register],
    });

    // Queue metrics
    this.queueSize = new Gauge({
      name: 'scheduler_queue_size',
      help: 'Current number of jobs in queue',
      labelNames: ['queue_name', 'state'],
      registers: [this.register],
    });

    this.queueWaitTime = new Histogram({
      name: 'scheduler_queue_wait_time_seconds',
      help: 'Time jobs spend waiting in queue',
      labelNames: ['queue_name', 'priority'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600],
      registers: [this.register],
    });

    this.activeJobs = new Gauge({
      name: 'scheduler_active_jobs',
      help: 'Number of currently executing jobs',
      labelNames: ['queue_name'],
      registers: [this.register],
    });

    this.completedJobs = new Gauge({
      name: 'scheduler_completed_jobs',
      help: 'Number of completed jobs in queue',
      labelNames: ['queue_name'],
      registers: [this.register],
    });

    this.failedJobs = new Gauge({
      name: 'scheduler_failed_jobs',
      help: 'Number of failed jobs in queue',
      labelNames: ['queue_name'],
      registers: [this.register],
    });

    // Execution metrics
    this.executionAttempts = new Histogram({
      name: 'scheduler_execution_attempts',
      help: 'Number of attempts before job completion',
      labelNames: ['category'],
      buckets: [1, 2, 3, 4, 5, 10],
      registers: [this.register],
    });

    this.executionRetries = new Counter({
      name: 'scheduler_execution_retries_total',
      help: 'Total number of job retries',
      labelNames: ['category', 'attempt_number'],
      registers: [this.register],
    });

    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.logger.log('Prometheus metrics initialized');
  }

  // Helper methods for recording metrics

  recordJobCreated(category: string, priority: string, targetService: string) {
    this.jobsCreated.inc({ category, priority, target_service: targetService });
  }

  recordJobCompleted(category: string, targetService: string, durationSeconds: number) {
    this.jobsCompleted.inc({ category, target_service: targetService });
    this.jobDuration.observe(
      { category, target_service: targetService, status: 'completed' },
      durationSeconds,
    );
  }

  recordJobFailed(category: string, targetService: string, errorType: string, durationSeconds: number) {
    this.jobsFailed.inc({ category, target_service: targetService, error_type: errorType });
    this.jobDuration.observe(
      { category, target_service: targetService, status: 'failed' },
      durationSeconds,
    );
  }

  recordJobCancelled(category: string) {
    this.jobsCancelled.inc({ category });
  }

  recordExecutionAttempt(category: string, attemptNumber: number) {
    this.executionAttempts.observe({ category }, attemptNumber);
    if (attemptNumber > 1) {
      this.executionRetries.inc({ category, attempt_number: attemptNumber.toString() });
    }
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      durationSeconds,
    );
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  async updateQueueMetrics(queueName: string, metrics: {
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
  }) {
    if (metrics.waiting !== undefined) {
      this.queueSize.set({ queue_name: queueName, state: 'waiting' }, metrics.waiting);
    }
    if (metrics.active !== undefined) {
      this.activeJobs.set({ queue_name: queueName }, metrics.active);
    }
    if (metrics.completed !== undefined) {
      this.completedJobs.set({ queue_name: queueName }, metrics.completed);
    }
    if (metrics.failed !== undefined) {
      this.failedJobs.set({ queue_name: queueName }, metrics.failed);
    }
    if (metrics.delayed !== undefined) {
      this.queueSize.set({ queue_name: queueName, state: 'delayed' }, metrics.delayed);
    }
  }
}
