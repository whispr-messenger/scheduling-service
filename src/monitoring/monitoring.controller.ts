import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly monitoringService: MonitoringService,
  ) {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  check() {
    return this.health.check([() => this.monitoringService.isHealthy('scheduling-service')]);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get service status information' })
  @ApiResponse({ status: 200, description: 'Service status information' })
  getStatus() {
    return this.monitoringService.getServiceInfo();
  }
}
