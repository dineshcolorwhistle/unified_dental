import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
  IsArray,
  IsIn,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @IsNotEmpty()
  @IsString()
  doctorId: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number = 30;

  @IsOptional()
  actualStartTime?: string | Date;

  @IsOptional()
  actualEndTime?: string | Date;

  @IsOptional()
  @IsString()
  type?: string = 'CONSULTATION';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedAmount?: number;

  @IsOptional()
  @IsString()
  patientOdontogramId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanGroupId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanGroupName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  treatmentPlanItemIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['GROUP', 'ITEM'])
  treatmentPlanScope?: 'GROUP' | 'ITEM';
}
