import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { RedisService } from '../../common/redis.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisService],
})
export class MonitoringModule {}