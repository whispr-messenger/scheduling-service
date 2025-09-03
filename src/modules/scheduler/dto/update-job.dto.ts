import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({
    description: 'Date de suppression logique (soft delete)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  deletedAt?: string;
}