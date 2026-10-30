import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OdontogramTreatmentStatus } from '@prisma/client';

export class UpdatePatientTreatmentDto {
  @ApiPropertyOptional({
    description: 'Surface of the tooth: WHOLE, OCCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL',
    example: 'WHOLE',
  })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({
    description: 'Name of the treatment',
    example: 'Porcelain Crown',
  })
  @IsOptional()
  @IsString()
  treatmentName?: string;

  @ApiPropertyOptional({
    description: 'Hex color representation',
    example: '#10B981',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #10B981)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Treatment status: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED',
    enum: OdontogramTreatmentStatus,
    example: OdontogramTreatmentStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(OdontogramTreatmentStatus)
  status?: OdontogramTreatmentStatus;

  @ApiPropertyOptional({
    description: 'Cost / procedure fee',
    example: 120.0,
  })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional({
    description: 'Clinical notes for this treatment plan item',
    example: 'Crown cemented successfully. Occlusion verified.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Planned execution date (ISO string)',
  })
  @IsOptional()
  @IsString()
  plannedDate?: string;

  @ApiPropertyOptional({
    description: 'Completed execution date (ISO string)',
  })
  @IsOptional()
  @IsString()
  completedDate?: string;
}

