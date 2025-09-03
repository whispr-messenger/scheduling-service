import { IsString, IsOptional, IsEnum, IsInt, IsDateString, IsBoolean, ValidateIf, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ScheduleJobDto {
  @ApiProperty({
    description: 'Type de planification',
    enum: ScheduleType,
    example: ScheduleType.CRON,
  })
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @ApiPropertyOptional({
    description: 'Expression cron pour planification récurrente',
    example: '0 9 * * 1-5',
    pattern: '^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every \\d+[smhdw])|((\\*|\\d+|\\d+-\\d+|\\d+/\\d+|\\*/\\d+)(\\s+|$)){5,6}$',
  })
  @ValidateIf(o => o.scheduleType === ScheduleType.CRON)
  @IsString()
  @Matches(/^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every \d+[smhdw])|((\*|\d+|\d+-\d+|\d+\/\d+|\*\/\d+)(\s+|$)){5,6}$/, {
    message: 'Expression cron invalide',
  })
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Intervalle en secondes pour planification par intervalle',
    example: 3600,
    minimum: 60,
  })
  @ValidateIf(o => o.scheduleType === ScheduleType.INTERVAL)
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  intervalSeconds?: number;

  @ApiPropertyOptional({
    description: 'Date/heure précise pour exécution unique (ISO 8601)',
    example: '2024-12-25T09:00:00Z',
  })
  @ValidateIf(o => o.scheduleType === ScheduleType.ONCE)
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Fuseau horaire pour l\'exécution',
    example: 'Europe/Paris',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Date de début de validité de la planification (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de validité de la planification (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    description: 'Indique si la planification est active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}