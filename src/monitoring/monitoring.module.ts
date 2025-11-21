import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { PrometheusService } from './prometheus.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [MonitoringController, MetricsController],
  providers: [MonitoringService, PrometheusService],
  exports: [MonitoringService, PrometheusService],
})
export class MonitoringModule {}
