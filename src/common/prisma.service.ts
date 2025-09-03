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
          url: configService.get<string>('database.url'),
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
    });
  }

  async onModuleInit() {
    try {
      // Connexion à la base de données
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database');

      // Écoute des événements de log Prisma
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
      });

      this.$on('info', (e) => {
        this.logger.log(`Info: ${e.message}`);
      });

      this.$on('warn', (e) => {
        this.logger.warn(`Warning: ${e.message}`);
      });

      this.$on('error', (e) => {
        this.logger.error(`Error: ${e.message}`, e.target);
      });

    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}