import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOdontogramTreatmentDto {
  @ApiPropertyOptional({
    description: 'Name of the treatment',
    example: 'Composite Filling',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the treatment',
    example: 'Tooth-colored resin filling',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color representation for odontogram mapping',
    example: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #3B82F6)',
  })
  color?: string;

  @ApiPropertyOptional({
    description:
      'Whether the treatment applies to the whole tooth instead of individual surfaces',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  appliesToWholeTooth?: boolean;
}

