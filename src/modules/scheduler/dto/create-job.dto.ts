import { IsString, IsOptional, IsEnum, IsInt, IsObject, Min, Max, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateJobDto {
  @ApiProperty({
    description: 'Nom de la tâche',
    example: 'Send scheduled message',
    maxLength: 200,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Description détaillée de la tâche',
    example: 'Envoi d\'un message programmé à une heure précise',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'ID de la catégorie de tâche',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description: 'Service cible à appeler',
    example: 'messaging-service',
    enum: ['messaging-service', 'notification-service', 'media-service', 'user-service', 'auth-service', 'moderation-service'],
  })
  @IsString()
  targetService: string;

  @ApiProperty({
    description: 'Méthode à exécuter sur le service cible',
    example: 'SendScheduledMessage',
  })
  @IsString()
  targetMethod: string;

  @ApiProperty({
    description: 'Données à passer à la méthode',
    example: { messageId: '123', recipientId: '456', content: 'Hello World' },
  })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priorité d\'exécution de la tâche',
    enum: Priority,
    example: Priority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Nombre maximum de tentatives en cas d\'échec',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Timeout en secondes pour l\'exécution',
    example: 300,
    minimum: 10,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  timeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Indique si la tâche est active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'ID de l\'utilisateur créateur de la tâche',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}