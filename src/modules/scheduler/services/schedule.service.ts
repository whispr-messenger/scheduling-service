import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { ScheduleJobDto } from '../dto/schedule-job.dto';
import { Schedule, Prisma } from '@prisma/client';
import { ScheduleType } from '../../../common/enums';
import * as moment from 'moment-timezone';
import * as cron from 'node-cron';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(jobId: string, scheduleDto: ScheduleJobDto): Promise<Schedule> {
    this.logger.log(`Creating schedule for job ${jobId}`);

    try {
      // Vérifier que la tâche existe et est active
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { category: true },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      if (!job.isActive || job.deletedAt) {
        throw new BadRequestException(`Job with ID ${jobId} is not active`);
      }

      // Valider la planification selon son type
      await this.validateSchedule(scheduleDto);

      const scheduleData: Prisma.ScheduleCreateInput = {
        job: {
          connect: { id: jobId },
        },
        scheduleType: scheduleDto.scheduleType,
        cronExpression: scheduleDto.cronExpression,
        intervalSeconds: scheduleDto.intervalSeconds,
        scheduledAt: scheduleDto.scheduledAt ? new Date(scheduleDto.scheduledAt) : null,
        timezone: scheduleDto.timezone ?? 'UTC',
        startsAt: scheduleDto.startsAt ? new Date(scheduleDto.startsAt) : null,
        endsAt: scheduleDto.endsAt ? new Date(scheduleDto.endsAt) : null,
        isActive: scheduleDto.isActive ?? true,
      };

      const schedule = await this.prisma.schedule.create({
        data: scheduleData,
      });

      this.logger.log(`Successfully created schedule with ID: ${schedule.id}`);
      return schedule;
    } catch (error) {
      this.logger.error(`Failed to create schedule for job ${jobId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findSchedulesByJob(jobId: string): Promise<Schedule[]> {
    const schedules = await this.prisma.schedule.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return schedules;
  }

  async findActiveSchedules(): Promise<Schedule[]> {
    const now = new Date();
    
    const schedules = await this.prisma.schedule.findMany({
      where: {
        isActive: true,
        job: {
          isActive: true,
          deletedAt: null,
        },
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: now } },
            ],
          },
        ],
      },
      include: {
        job: {
          include: {
            category: true,
          },
        },
      },
    });

    return schedules;
  }

  async updateSchedule(id: string, scheduleDto: Partial<ScheduleJobDto>): Promise<Schedule> {
    this.logger.log(`Updating schedule with ID: ${id}`);

    // Vérifier que la planification existe
    const existingSchedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    try {
      // Valider les nouvelles données si des champs critiques sont modifiés
      if (scheduleDto.scheduleType || scheduleDto.cronExpression || scheduleDto.intervalSeconds || scheduleDto.scheduledAt) {
        const fullScheduleDto: ScheduleJobDto = {
          scheduleType: scheduleDto.scheduleType ?? (existingSchedule.scheduleType as ScheduleType),
          cronExpression: scheduleDto.cronExpression ?? existingSchedule.cronExpression,
          intervalSeconds: scheduleDto.intervalSeconds ?? existingSchedule.intervalSeconds,
          scheduledAt: scheduleDto.scheduledAt ?? existingSchedule.scheduledAt?.toISOString(),
          timezone: scheduleDto.timezone ?? existingSchedule.timezone,
          startsAt: scheduleDto.startsAt ?? existingSchedule.startsAt?.toISOString(),
          endsAt: scheduleDto.endsAt ?? existingSchedule.endsAt?.toISOString(),
          isActive: scheduleDto.isActive ?? existingSchedule.isActive,
        };

        await this.validateSchedule(fullScheduleDto);
      }

      const updatedSchedule = await this.prisma.schedule.update({
        where: { id },
        data: {
          ...scheduleDto,
          ...(scheduleDto.scheduledAt && { scheduledAt: new Date(scheduleDto.scheduledAt) }),
          ...(scheduleDto.startsAt && { startsAt: new Date(scheduleDto.startsAt) }),
          ...(scheduleDto.endsAt && { endsAt: new Date(scheduleDto.endsAt) }),
        },
      });

      this.logger.log(`Successfully updated schedule with ID: ${id}`);
      return updatedSchedule;
    } catch (error) {
      this.logger.error(`Failed to update schedule ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deactivateSchedule(id: string): Promise<Schedule> {
    this.logger.log(`Deactivating schedule with ID: ${id}`);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    try {
      const deactivatedSchedule = await this.prisma.schedule.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Successfully deactivated schedule with ID: ${id}`);
      return deactivatedSchedule;
    } catch (error) {
      this.logger.error(`Failed to deactivate schedule ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    this.logger.log(`Deleting schedule with ID: ${id}`);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    try {
      await this.prisma.schedule.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted schedule with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete schedule ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getNextExecution(schedule: Schedule): Promise<Date | null> {
    const now = moment().tz(schedule.timezone);
    let nextExecution: moment.Moment | null = null;

    switch (schedule.scheduleType) {
      case ScheduleType.IMMEDIATE:
        return new Date();

      case ScheduleType.ONCE:
        if (schedule.scheduledAt) {
          const scheduledTime = moment(schedule.scheduledAt).tz(schedule.timezone);
          return scheduledTime.isAfter(now) ? scheduledTime.toDate() : null;
        }
        return null;

      case ScheduleType.INTERVAL:
        if (schedule.intervalSeconds) {
          // Pour les intervalles, la prochaine exécution est maintenant + intervalle
          nextExecution = now.clone().add(schedule.intervalSeconds, 'seconds');
        }
        break;

      case ScheduleType.CRON:
        if (schedule.cronExpression) {
          try {
            // Utiliser node-cron pour calculer la prochaine exécution
            const cronIterator = cron.schedule(schedule.cronExpression, () => {}, {
              scheduled: false,
              timezone: schedule.timezone,
            });
            
            // Approche alternative: parser manuellement l'expression cron
            nextExecution = this.getNextCronExecution(schedule.cronExpression, now);
          } catch (error) {
            this.logger.error(`Invalid cron expression: ${schedule.cronExpression}`, error);
            return null;
          }
        }
        break;
    }

    if (!nextExecution) {
      return null;
    }

    // Vérifier les contraintes de début et fin
    if (schedule.startsAt && nextExecution.isBefore(schedule.startsAt)) {
      if (schedule.scheduleType === ScheduleType.INTERVAL && schedule.intervalSeconds) {
        // Pour les intervalles, commencer à startsAt
        nextExecution = moment(schedule.startsAt).tz(schedule.timezone);
      } else if (schedule.scheduleType === ScheduleType.CRON) {
        // Pour les crons, trouver la prochaine occurrence après startsAt
        nextExecution = this.getNextCronExecution(
          schedule.cronExpression!,
          moment(schedule.startsAt).tz(schedule.timezone)
        );
      }
    }

    if (schedule.endsAt && nextExecution?.isAfter(schedule.endsAt)) {
      return null;
    }

    return nextExecution?.toDate() || null;
  }

  private async validateSchedule(scheduleDto: ScheduleJobDto): Promise<void> {
    const { scheduleType, cronExpression, intervalSeconds, scheduledAt, startsAt, endsAt } = scheduleDto;

    switch (scheduleType) {
      case ScheduleType.CRON:
        if (!cronExpression) {
          throw new BadRequestException('Cron expression is required for CRON schedule type');
        }
        if (!cron.validate(cronExpression)) {
          throw new BadRequestException(`Invalid cron expression: ${cronExpression}`);
        }
        break;

      case ScheduleType.INTERVAL:
        if (!intervalSeconds || intervalSeconds < 60) {
          throw new BadRequestException('Interval seconds must be at least 60 seconds for INTERVAL schedule type');
        }
        break;

      case ScheduleType.ONCE:
        if (!scheduledAt) {
          throw new BadRequestException('Scheduled date/time is required for ONCE schedule type');
        }
        const scheduledTime = moment(scheduledAt);
        if (!scheduledTime.isValid()) {
          throw new BadRequestException(`Invalid scheduled date/time: ${scheduledAt}`);
        }
        if (scheduledTime.isBefore(moment())) {
          throw new BadRequestException('Scheduled date/time cannot be in the past');
        }
        break;

      case ScheduleType.IMMEDIATE:
        // Pas de validation spécifique pour IMMEDIATE
        break;

      default:
        throw new BadRequestException(`Invalid schedule type: ${scheduleType}`);
    }

    // Valider les contraintes de début et fin
    if (startsAt && endsAt) {
      const startsTime = moment(startsAt);
      const endsTime = moment(endsAt);

      if (!startsTime.isValid()) {
        throw new BadRequestException(`Invalid starts at date/time: ${startsAt}`);
      }

      if (!endsTime.isValid()) {
        throw new BadRequestException(`Invalid ends at date/time: ${endsAt}`);
      }

      if (endsTime.isSameOrBefore(startsTime)) {
        throw new BadRequestException('End time must be after start time');
      }
    }

    // Valider le fuseau horaire
    if (scheduleDto.timezone && !moment.tz.zone(scheduleDto.timezone)) {
      throw new BadRequestException(`Invalid timezone: ${scheduleDto.timezone}`);
    }
  }

  private getNextCronExecution(cronExpression: string, from: moment.Moment): moment.Moment | null {
    try {
      // Implémentation basique pour calculer la prochaine exécution cron
      // Dans un vrai projet, utiliser une bibliothèque comme 'cronstrue' ou 'node-cron'
      
      // Pour l'instant, retourner une approximation simple
      // Cette logique devrait être remplacée par une bibliothèque cron complète
      const nextMinute = from.clone().add(1, 'minute').startOf('minute');
      return nextMinute;
    } catch (error) {
      this.logger.error(`Error calculating next cron execution: ${error.message}`);
      return null;
    }
  }

  async cleanupExpiredSchedules(): Promise<number> {
    this.logger.debug('Cleaning up expired schedules');

    try {
      const result = await this.prisma.schedule.updateMany({
        where: {
          isActive: true,
          scheduleType: ScheduleType.ONCE,
          scheduledAt: {
            lt: new Date(),
          },
        },
        data: {
          isActive: false,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Deactivated ${result.count} expired one-time schedules`);
      }

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired schedules: ${error.message}`, error.stack);
      return 0;
    }
  }
}