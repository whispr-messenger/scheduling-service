import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { QueryJobsDto } from '../dto/query-jobs.dto';
import { Job, JobCategory, Schedule, Execution, Prisma } from '@prisma/client';

export type JobWithRelations = Job & {
  category?: JobCategory;
  schedules?: Schedule[];
  executions?: Execution[];
};

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto): Promise<JobWithRelations> {
    this.logger.log(`Creating new job: ${createJobDto.name}`);

    try {
      // Vérifier que la catégorie existe
      const category = await this.prisma.jobCategory.findUnique({
        where: { id: createJobDto.categoryId },
      });

      if (!category) {
        throw new BadRequestException(`Job category with ID ${createJobDto.categoryId} not found`);
      }

      if (!category.isActive) {
        throw new BadRequestException(`Job category '${category.name}' is not active`);
      }

      // Valider le service cible et la méthode
      await this.validateTargetServiceAndMethod(
        createJobDto.targetService,
        createJobDto.targetMethod,
      );

      // Créer la tâche avec les valeurs par défaut de la catégorie si non spécifiées
      const jobData: Prisma.JobCreateInput = {
        name: createJobDto.name,
        description: createJobDto.description,
        category: {
          connect: { id: createJobDto.categoryId },
        },
        targetService: createJobDto.targetService,
        targetMethod: createJobDto.targetMethod,
        payload: createJobDto.payload,
        priority: createJobDto.priority ?? category.defaultPriority,
        maxRetries: createJobDto.maxRetries ?? category.defaultMaxRetries,
        timeoutSeconds: createJobDto.timeoutSeconds ?? category.defaultTimeout,
        isActive: createJobDto.isActive ?? true,
        createdBy: createJobDto.createdBy,
      };

      const job = await this.prisma.job.create({
        data: jobData,
        include: {
          category: true,
          schedules: true,
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      this.logger.log(`Successfully created job with ID: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to create job: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(queryDto: QueryJobsDto): Promise<{
    jobs: JobWithRelations[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const { page = 1, limit = 20, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    // Construire les conditions de filtrage
    const where: Prisma.JobWhereInput = {
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.targetService && { targetService: filters.targetService }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.createdBy && { createdBy: filters.createdBy }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.includeDeleted ? {} : { deletedAt: null }),
    };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          category: true,
          schedules: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      jobs,
      total,
      totalPages,
      currentPage: page,
    };
  }

  async findOne(id: string, includeDeleted = false): Promise<JobWithRelations> {
    this.logger.debug(`Finding job with ID: ${id}`);

    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: true,
        schedules: {
          orderBy: { createdAt: 'desc' },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    if (!includeDeleted && job.deletedAt) {
      throw new NotFoundException(`Job with ID ${id} has been deleted`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<JobWithRelations> {
    this.logger.log(`Updating job with ID: ${id}`);

    // Vérifier que la tâche existe
    const existingJob = await this.findOne(id);

    try {
      // Si la catégorie est changée, vérifier qu'elle existe et est active
      if (updateJobDto.categoryId && updateJobDto.categoryId !== existingJob.categoryId) {
        const category = await this.prisma.jobCategory.findUnique({
          where: { id: updateJobDto.categoryId },
        });

        if (!category) {
          throw new BadRequestException(`Job category with ID ${updateJobDto.categoryId} not found`);
        }

        if (!category.isActive) {
          throw new BadRequestException(`Job category '${category.name}' is not active`);
        }
      }

      // Valider le service cible et la méthode si changés
      if (updateJobDto.targetService || updateJobDto.targetMethod) {
        await this.validateTargetServiceAndMethod(
          updateJobDto.targetService ?? existingJob.targetService,
          updateJobDto.targetMethod ?? existingJob.targetMethod,
        );
      }

      const updatedJob = await this.prisma.job.update({
        where: { id },
        data: {
          ...updateJobDto,
          ...(updateJobDto.categoryId && {
            category: {
              connect: { id: updateJobDto.categoryId },
            },
          }),
          ...(updateJobDto.deletedAt && {
            deletedAt: new Date(updateJobDto.deletedAt),
          }),
        },
        include: {
          category: true,
          schedules: true,
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      this.logger.log(`Successfully updated job with ID: ${id}`);
      return updatedJob;
    } catch (error) {
      this.logger.error(`Failed to update job ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async softDelete(id: string): Promise<JobWithRelations> {
    this.logger.log(`Soft deleting job with ID: ${id}`);

    // Vérifier que la tâche existe
    await this.findOne(id);

    try {
      // Désactiver d'abord toutes les planifications
      await this.prisma.schedule.updateMany({
        where: { jobId: id },
        data: { isActive: false },
      });

      // Marquer la tâche comme supprimée
      const deletedJob = await this.prisma.job.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
        include: {
          category: true,
          schedules: true,
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      this.logger.log(`Successfully soft deleted job with ID: ${id}`);
      return deletedJob;
    } catch (error) {
      this.logger.error(`Failed to soft delete job ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async restore(id: string): Promise<JobWithRelations> {
    this.logger.log(`Restoring job with ID: ${id}`);

    const job = await this.findOne(id, true);

    if (!job.deletedAt) {
      throw new BadRequestException(`Job with ID ${id} is not deleted`);
    }

    try {
      const restoredJob = await this.prisma.job.update({
        where: { id },
        data: {
          isActive: true,
          deletedAt: null,
        },
        include: {
          category: true,
          schedules: true,
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      this.logger.log(`Successfully restored job with ID: ${id}`);
      return restoredJob;
    } catch (error) {
      this.logger.error(`Failed to restore job ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async hardDelete(id: string): Promise<void> {
    this.logger.warn(`Hard deleting job with ID: ${id}`);

    // Vérifier que la tâche existe
    await this.findOne(id, true);

    try {
      // Supprimer définitivement (les relations seront supprimées en cascade)
      await this.prisma.job.delete({
        where: { id },
      });

      this.logger.log(`Successfully hard deleted job with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to hard delete job ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActiveJobsByCategory(categoryName: string): Promise<JobWithRelations[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        category: {
          name: categoryName,
          isActive: true,
        },
      },
      include: {
        category: true,
        schedules: {
          where: { isActive: true },
        },
      },
    });

    return jobs;
  }

  async getActiveJobsByService(targetService: string): Promise<JobWithRelations[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        targetService,
      },
      include: {
        category: true,
        schedules: {
          where: { isActive: true },
        },
      },
    });

    return jobs;
  }

  private async validateTargetServiceAndMethod(
    targetService: string,
    targetMethod: string,
  ): Promise<void> {
    // Liste des services autorisés
    const allowedServices = [
      'messaging-service',
      'notification-service',
      'media-service',
      'user-service',
      'auth-service',
      'moderation-service',
    ];

    if (!allowedServices.includes(targetService)) {
      throw new BadRequestException(
        `Invalid target service '${targetService}'. Allowed services: ${allowedServices.join(', ')}`,
      );
    }

    // Validation basique du nom de méthode (peut être étendue)
    if (!targetMethod || targetMethod.trim().length === 0) {
      throw new BadRequestException('Target method cannot be empty');
    }

    // Vérifier que le nom de méthode ne contient que des caractères alphanumériques et underscores
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(targetMethod)) {
      throw new BadRequestException(
        'Target method name must start with a letter and contain only alphanumeric characters and underscores',
      );
    }
  }
}