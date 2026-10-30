import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPatientDiagnosticDto {
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
    description: 'Optional ID of configured ClinicOdontogramDiagnostic item',
  })
  @IsOptional()
  @IsUUID()
  diagnosticId?: string;

  @ApiProperty({
    description: 'Name of the diagnostic condition (e.g. Dental Caries, Fracture)',
    example: 'Dental Caries',
  })
  @IsString()
  @IsNotEmpty()
  diagnosticName: string;

  @ApiPropertyOptional({
    description: 'Hex color representation of the diagnostic',
    example: '#EF4444',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #EF4444)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes or severity for this diagnostic finding',
    example: 'Moderate enamel and dentin cavitated lesion on occlusal groove.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

