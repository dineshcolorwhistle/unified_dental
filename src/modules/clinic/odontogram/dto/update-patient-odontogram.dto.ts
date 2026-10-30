import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TeethModel } from '@prisma/client';

export class UpdatePatientOdontogramDto {
  @ApiPropertyOptional({
    description: 'Teeth model arch used for this patient odontogram (ADULT or CHILD)',
    enum: TeethModel,
    example: TeethModel.ADULT,
  })
  @IsOptional()
  @IsEnum(TeethModel)
  teethModel?: TeethModel;

  @ApiPropertyOptional({
    description: 'General clinical notes or odontogram observations for this patient',
    example: 'Patient presents with generalized plaque and prior composite restorations on upper molars.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

