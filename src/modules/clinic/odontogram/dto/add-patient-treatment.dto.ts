import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OdontogramTreatmentStatus } from '@prisma/client';

export class AddPatientTreatmentDto {
  @ApiProperty({
    description: 'FDI tooth number (e.g. 11-48 for adult, 51-85 for child)',
    example: 16,
  })
  @IsInt()
  @Min(11)
  @Max(85)
  toothNumber: number;

  @ApiPropertyOptional({
    description:
      'Surface of the tooth: WHOLE, OCCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL',
    example: 'OCCLUSAL',
    default: 'WHOLE',
  })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({
    description: 'Optional ID of configured ClinicOdontogramTreatment item',
  })
  @IsOptional()
  @IsUUID()
  treatmentId?: string;

  @ApiProperty({
    description: 'Name of the treatment (e.g. Composite Restoration, Crown, Root Canal)',
    example: 'Composite Restoration',
  })
  @IsString()
  @IsNotEmpty()
  treatmentName: string;

  @ApiPropertyOptional({
    description: 'Hex color representation for the treatment',
    example: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #3B82F6)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Treatment status: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED',
    enum: OdontogramTreatmentStatus,
    default: OdontogramTreatmentStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(OdontogramTreatmentStatus)
  status?: OdontogramTreatmentStatus;

  @ApiPropertyOptional({
    description: 'Estimated cost / procedure fee',
    example: 75.0,
  })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional({
    description: 'Clinical notes or instructions for the treatment',
    example: 'Class I resin restoration under local anesthesia.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Planned date of execution (ISO string)',
  })
  @IsOptional()
  @IsString()
  plannedDate?: string;
}

