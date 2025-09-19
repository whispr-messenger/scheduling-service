import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JobService } from '../services/job.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { QueryJobsDto } from '../dto/query-jobs.dto';
import { JobResponseDto } from '../dto/job-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, Permissions, Role, Permission } from '../../../common/guards/roles.guard';

@ApiTags('jobs')
@Controller('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 5, ttl: 1000 } })
  @Permissions(Permission.CREATE_JOB)
  @ApiOperation({
    summary: 'Créer une nouvelle tâche',
    description: 'Crée une nouvelle tâche programmable dans le système de scheduling',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tâche créée avec succès',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données de la tâche invalides',
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
    @Body(ValidationPipe) createJobDto: CreateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobService.create(createJobDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les tâches',
    description: 'Récupère la liste des tâches avec filtrage et pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des tâches récupérée avec succès',
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: { $ref: '#/components/schemas/JobResponseDto' },
        },
        total: { type: 'number' },
        totalPages: { type: 'number' },
        currentPage: { type: 'number' },
      },
    },
  })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'categoryId', required: false, type: 'string' })
  @ApiQuery({ name: 'targetService', required: false, type: 'string' })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'isActive', required: false, type: 'boolean' })
  @ApiQuery({ name: 'createdBy', required: false, type: 'string' })
  @ApiQuery({ name: 'search', required: false, type: 'string' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: 'boolean' })
  async findAll(@Query(ValidationPipe) queryDto: QueryJobsDto) {
    return this.jobService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une tâche par ID',
    description: 'Récupère les détails d\'une tâche spécifique avec ses planifications et exécutions',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: 'boolean',
    description: 'Inclure les tâches supprimées',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Détails de la tâche récupérés avec succès',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ): Promise<JobResponseDto> {
    return this.jobService.findOne(id, includeDeleted);
  }

  @Patch(':id')
  @Permissions(Permission.UPDATE_JOB)
  @ApiOperation({
    summary: 'Mettre à jour une tâche',
    description: 'Met à jour les propriétés d\'une tâche existante',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tâche mise à jour avec succès',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données de mise à jour invalides',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateJobDto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobService.update(id, updateJobDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.DELETE_JOB)
  @ApiOperation({
    summary: 'Supprimer une tâche (suppression logique)',
    description: 'Effectue une suppression logique de la tâche et désactive ses planifications',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tâche supprimée avec succès (suppression logique)',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<JobResponseDto> {
    return this.jobService.softDelete(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restaurer une tâche supprimée',
    description: 'Restaure une tâche précédemment supprimée logiquement',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tâche restaurée avec succès',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'La tâche n\'est pas supprimée',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<JobResponseDto> {
    return this.jobService.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { limit: 2, ttl: 10000 } })
  @Roles(Role.ADMIN)
  @Permissions(Permission.ADMIN_OPERATIONS)
  @ApiOperation({
    summary: 'Supprimer définitivement une tâche',
    description: 'Supprime définitivement une tâche et toutes ses données associées (ATTENTION: irréversible)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la tâche (UUID)',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Tâche supprimée définitivement',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tâche non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Trop de suppressions, limite de sécurité atteinte',
  })
  async hardDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.jobService.hardDelete(id);
  }

  @Get('category/:categoryName')
  @ApiOperation({
    summary: 'Lister les tâches par catégorie',
    description: 'Récupère toutes les tâches actives d\'une catégorie spécifique',
  })
  @ApiParam({
    name: 'categoryName',
    description: 'Nom de la catégorie de tâches',
    type: 'string',
    enum: ['messaging', 'notifications', 'maintenance', 'cleanup', 'reports', 'analytics'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des tâches de la catégorie récupérée avec succès',
    type: [JobResponseDto],
  })
  async getJobsByCategory(@Param('categoryName') categoryName: string): Promise<JobResponseDto[]> {
    return this.jobService.getActiveJobsByCategory(categoryName);
  }

  @Get('service/:targetService')
  @ApiOperation({
    summary: 'Lister les tâches par service cible',
    description: 'Récupère toutes les tâches actives pour un service cible spécifique',
  })
  @ApiParam({
    name: 'targetService',
    description: 'Nom du service cible',
    type: 'string',
    enum: ['messaging-service', 'notification-service', 'media-service', 'user-service', 'auth-service', 'moderation-service'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des tâches du service récupérée avec succès',
    type: [JobResponseDto],
  })
  async getJobsByService(@Param('targetService') targetService: string): Promise<JobResponseDto[]> {
    return this.jobService.getActiveJobsByService(targetService);
  }
}