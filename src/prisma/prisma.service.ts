import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');

      // Log slow queries in development
      if (process.env.NODE_ENV === 'development') {
        this.$on('query' as never, (e: any) => {
          if (e.duration > 1000) {
            this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
          }
        });
      }

      this.$on('error' as never, (e: any) => {
        this.logger.error('Prisma error:', e);
      });

      this.$on('warn' as never, (e: any) => {
        this.logger.warn('Prisma warning:', e);
      });
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );

    return Promise.all(
      models.map((model) => {
        const modelClient = (this as Record<string, any>)[model];
        if (modelClient && typeof modelClient.deleteMany === 'function') {
          return modelClient.deleteMany();
        }
      }),
    );
  }
}
