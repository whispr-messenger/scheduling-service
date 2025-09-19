import { ApiProperty } from '@nestjs/swagger';

export class ScheduleResponseDto {
  @ApiProperty({
    description: 'ID unique de la planification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'ID de la tâche associée',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  jobId: string;

  @ApiProperty({
    description: 'Type de planification',
    enum: ['CRON', 'INTERVAL', 'ONCE', 'IMMEDIATE'],
    example: 'CRON',
  })
  scheduleType: string;

  @ApiProperty({
    description: 'Expression cron (pour type CRON)',
    example: '0 9 * * 1-5',
    required: false,
  })
  cronExpression?: string;

  @ApiProperty({
    description: 'Intervalle en secondes (pour type INTERVAL)',
    example: 3600,
    required: false,
  })
  intervalSeconds?: number;

  @ApiProperty({
    description: 'Date et heure de planification (pour type ONCE)',
    example: '2024-12-25T09:00:00Z',
    required: false,
  })
  scheduledAt?: Date;

  @ApiProperty({
    description: 'Fuseau horaire',
    example: 'Europe/Paris',
    required: false,
  })
  timezone?: string;

  @ApiProperty({
    description: 'Date de début de validité',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  startsAt?: Date;

  @ApiProperty({
    description: 'Date de fin de validité',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  endsAt?: Date;

  @ApiProperty({
    description: 'Indique si la planification est active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Date de création',
    example: '2024-01-01T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2024-01-01T10:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Informations sur la tâche associée',
    required: false,
  })
  job?: {
    id: string;
    name: string;
    description?: string;
    targetService: string;
    targetMethod: string;
  };
}