import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'colorless',
    });

    // Set up logging
    this.$on('query' as never, (e: any) => {
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
      }
    });

    this.$on('error' as never, (e: any) => {
      this.logger.error('Prisma error:', e);
    });

    this.$on('info' as never, (e: any) => {
      this.logger.log('Prisma info:', e.message);
    });

    this.$on('warn' as never, (e: any) => {
      this.logger.warn('Prisma warning:', e.message);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');

      // Test connection
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection test successful');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  async getConnectionInfo() {
    try {
      const result = await this.$queryRaw`
        SELECT
          current_database() as database,
          current_user as user,
          version() as version,
          now() as current_time
      `;
      return result;
    } catch (error) {
      this.logger.error('Failed to get connection info:', error);
      throw error;
    }
  }
}
