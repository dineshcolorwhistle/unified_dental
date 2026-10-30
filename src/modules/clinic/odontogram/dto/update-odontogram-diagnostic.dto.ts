import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOdontogramDiagnosticDto {
  @ApiPropertyOptional({
    description: 'Name of the diagnostic entry',
    example: 'Dental Caries',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the diagnostic',
    example: 'Tooth decay on coronal or root surface',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color representation for odontogram mapping',
    example: '#EF4444',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #EF4444)',
  })
  color?: string;

  @ApiPropertyOptional({
    description:
      'Whether the diagnostic applies to the whole tooth instead of individual surfaces',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  appliesToWholeTooth?: boolean;
}

