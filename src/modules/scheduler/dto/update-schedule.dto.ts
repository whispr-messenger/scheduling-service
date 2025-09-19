import { PartialType } from '@nestjs/swagger';
import { ScheduleJobDto } from './schedule-job.dto';

export class UpdateScheduleDto extends PartialType(ScheduleJobDto) {}