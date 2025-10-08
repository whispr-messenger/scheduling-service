import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicator } from '@nestjs/terminus';

@Injectable()
export class MonitoringService extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Basic health check - can be extended with actual service checks
    const isHealthy = true; // Add actual health logic here

    const result = this.getStatus(key, isHealthy, {
      message: 'Scheduling service is operational',
    });

    if (isHealthy) {
      return result;
    }

    throw new Error('Scheduling service is unhealthy');
  }

  getServiceInfo() {
    return {
      service: 'whispr-scheduling-service',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };
  }
}
