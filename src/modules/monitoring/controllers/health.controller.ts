import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../../common/prisma.service';
import { RedisService } from '../../../common/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Vérification de santé globale',
    description: 'Effectue une vérification complète de la santé du service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service en bonne santé',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error', 'shutting_down'] },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service en mauvaise santé',
  })
  @HealthCheck()
  check() {
    return this.health.check([
      // Vérification de la base de données PostgreSQL
      () => this.checkDatabase(),
      
      // Vérification de Redis
      () => this.checkRedis(),
      
      // Vérification de la mémoire (< 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      
      // Vérification de l'espace disque (< 90%)
      () => this.disk.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
    ]);
  }

  @Get('database')
  @ApiOperation({
    summary: 'Vérification de santé de la base de données',
    description: 'Vérifie la connectivité et la santé de PostgreSQL',
  })
  @HealthCheck()
  checkDatabase() {
    return this.health.check([
      async () => {
        const isHealthy = await this.prisma.healthCheck();
        if (isHealthy) {
          return {
            database: {
              status: 'up',
              message: 'PostgreSQL connection is healthy',
            },
          };
        } else {
          throw new Error('PostgreSQL connection failed');
        }
      },
    ]);
  }

  @Get('redis')
  @ApiOperation({
    summary: 'Vérification de santé de Redis',
    description: 'Vérifie la connectivité et la santé de Redis',
  })
  @HealthCheck()
  checkRedis() {
    return this.health.check([
      async () => {
        const isHealthy = await this.redis.healthCheck();
        if (isHealthy) {
          return {
            redis: {
              status: 'up',
              message: 'Redis connection is healthy',
            },
          };
        } else {
          throw new Error('Redis connection failed');
        }
      },
    ]);
  }

  @Get('memory')
  @ApiOperation({
    summary: 'Vérification de l\'utilisation mémoire',
    description: 'Vérifie l\'utilisation de la mémoire heap',
  })
  @HealthCheck()
  checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }

  @Get('disk')
  @ApiOperation({
    summary: 'Vérification de l\'espace disque',
    description: 'Vérifie l\'espace disque disponible',
  })
  @HealthCheck()
  checkDisk() {
    return this.health.check([
      () => this.disk.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
    ]);
  }
}