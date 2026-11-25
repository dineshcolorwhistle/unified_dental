import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TREATMENT_PLAN_STATUSES = [
  'CREATED',
  'PRESENTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

export type TreatmentPlanStatusType = (typeof TREATMENT_PLAN_STATUSES)[number];

export class UpdateTreatmentPlanStatusDto {
  @ApiProperty({
    description: 'New treatment plan status',
    enum: TREATMENT_PLAN_STATUSES,
  })
  @IsString()
  @IsIn([...TREATMENT_PLAN_STATUSES])
  status: TreatmentPlanStatusType;

  @ApiPropertyOptional({
    description: 'Optional plan name for initializing an unsaved draft group',
  })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({
    description: 'Optional items snapshot when initializing an unsaved draft group',
  })
  @IsOptional()
  @IsArray()
  items?: any[];
}
