import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Priority } from '@prisma/client';

export class CreateJobDto {
  @ApiProperty({
    description: 'Name of the job',
    example: 'Send welcome email',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the job',
    example: 'Send a welcome email to new users with onboarding information',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Category ID for the job',
    example: 'e7f8a9b0-1234-5678-9abc-def012345678',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Target service to execute the job',
    example: 'messaging-service',
    enum: ['messaging-service', 'notification-service', 'media-service', 'user-service', 'auth-service'],
  })
  @IsString()
  @IsNotEmpty()
  targetService: string;

  @ApiProperty({
    description: 'Target method to call on the service',
    example: 'sendWelcomeEmail',
  })
  @IsString()
  @IsNotEmpty()
  targetMethod: string;

  @ApiProperty({
    description: 'JSON payload to pass to the target method',
    example: { userId: '123', template: 'welcome' },
  })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priority level of the job',
    enum: Priority,
    default: Priority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Maximum number of retry attempts',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Timeout in seconds for job execution',
    example: 300,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  timeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'User ID who created the job',
    example: 'e7f8a9b0-1234-5678-9abc-def012345678',
  })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}