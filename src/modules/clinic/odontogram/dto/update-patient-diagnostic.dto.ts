import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePatientDiagnosticDto {
  @ApiPropertyOptional({
    description: 'Surface of the tooth: WHOLE, OCCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL',
    example: 'WHOLE',
  })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({
    description: 'Name of the diagnostic condition',
    example: 'Enamel Fracture',
  })
  @IsOptional()
  @IsString()
  diagnosticName?: string;

  @ApiPropertyOptional({
    description: 'Hex color representation',
    example: '#EF4444',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #EF4444)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes for this diagnostic finding',
    example: 'Updated finding: superficial chip without pulp exposure.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

