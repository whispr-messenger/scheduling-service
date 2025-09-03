import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ScheduleService } from '../services/schedule.service';
import { ScheduleJobDto } from '../dto/schedule-job.dto';
import { ScheduleResponseDto } from '../dto/job-response.dto';

@ApiTags('schedules')
@Controller('schedules')
@ApiBearerAuth()
export class SchedulesController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('job/:jobId')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 10, ttl: 1000 } })
  @ApiOperation({
    summary: 'Créer une planification pour une tâche',
    description: 'Crée une nouvelle planification (cron, intervalle, unique, immédiate) pour une tâche existante',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Planification créée avec succès',
    type: ScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données de planification invalides',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token d\'authentification requis',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Trop de requêtes, limite de taux atteinte',
  })
  async create(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body(ValidationPipe) scheduleJobDto: ScheduleJobDto,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleService.createSchedule(jobId, scheduleJobDto);
  }

  @Get('job/:jobId')
  @ApiOperation({
    summary: 'Lister les planifications d\'une tâche',
    description: 'Récupère toutes les planifications (actives et inactives) d\'une tâche spécifique',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des planifications récupérée avec succès',
    type: [ScheduleResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  async findSchedulesByJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ScheduleResponseDto[]> {
    return this.scheduleService.findSchedulesByJob(jobId);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Lister toutes les planifications actives',
    description: 'Récupère toutes les planifications actives du système avec les détails des tâches associées',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des planifications actives récupérée avec succès',
    schema: {
      type: 'array',
      items: {
        allOf: [
          { $ref: '#/components/schemas/ScheduleResponseDto' },
          {
            type: 'object',
            properties: {
              job: { $ref: '#/components/schemas/JobResponseDto' },
            },
          },
        ],
      },
    },
  })
  async findActiveSchedules() {
    return this.scheduleService.findActiveSchedules();
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour une planification',
    description: 'Met à jour les propriétés d\'une planification existante',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la planification (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Planification mise à jour avec succès',
    type: ScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Planification non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données de mise à jour invalides',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) scheduleJobDto: Partial<ScheduleJobDto>,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleService.updateSchedule(id, scheduleJobDto);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Désactiver une planification',
    description: 'Désactive une planification sans la supprimer (peut être réactivée)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la planification (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Planification désactivée avec succès',
    type: ScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Planification non trouvée',
  })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleResponseDto> {
    return this.scheduleService.deactivateSchedule(id);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réactiver une planification',
    description: 'Réactive une planification précédemment désactivée',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la planification (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Planification réactivée avec succès',
    type: ScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Planification non trouvée',
  })
  async activate(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleResponseDto> {
    return this.scheduleService.updateSchedule(id, { isActive: true });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { limit: 5, ttl: 10000 } })
  @ApiOperation({
    summary: 'Supprimer une planification',
    description: 'Supprime définitivement une planification (ATTENTION: irréversible)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la planification (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Planification supprimée avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Planification non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Trop de suppressions, limite de sécurité atteinte',
  })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.scheduleService.deleteSchedule(id);
  }

  @Get(':id/next-execution')
  @ApiOperation({
    summary: 'Calculer la prochaine exécution',
    description: 'Calcule la date/heure de la prochaine exécution prévue pour une planification',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la planification (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prochaine exécution calculée avec succès',
    schema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string' },
        nextExecution: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Date/heure de la prochaine exécution (null si aucune)',
        },
        timezone: { type: 'string' },
        scheduleType: { type: 'string', enum: ['CRON', 'INTERVAL', 'ONCE', 'IMMEDIATE'] },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Planification non trouvée',
  })
  async getNextExecution(@Param('id', ParseUUIDPipe) id: string) {
    const schedule = await this.scheduleService.findSchedulesByJob(id);
    const foundSchedule = schedule.find(s => s.id === id);
    
    if (!foundSchedule) {
      throw new Error('Schedule not found'); // Sera capturé par le filtre d'exception
    }

    const nextExecution = await this.scheduleService.getNextExecution(foundSchedule);

    return {
      scheduleId: id,
      nextExecution,
      timezone: foundSchedule.timezone,
      scheduleType: foundSchedule.scheduleType,
    };
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 1, ttl: 60000 } })
  @ApiOperation({
    summary: 'Nettoyer les planifications expirées',
    description: 'Désactive automatiquement les planifications uniques (ONCE) expirées',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nettoyage effectué avec succès',
    schema: {
      type: 'object',
      properties: {
        cleanedCount: {
          type: 'number',
          description: 'Nombre de planifications nettoyées',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Opération de nettoyage limitée à 1 fois par minute',
  })
  async cleanupExpiredSchedules() {
    const cleanedCount = await this.scheduleService.cleanupExpiredSchedules();
    
    return {
      cleanedCount,
      timestamp: new Date().toISOString(),
    };
  }
}