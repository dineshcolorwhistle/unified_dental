import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TeethModel, OdontogramTreatmentStatus } from '@prisma/client';

export class SavePatientDiagnosticItemDto {
  @IsNumber()
  toothNumber: number;

  @IsString()
  surface: string;

  @IsString()
  diagnosticName: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  diagnosticId?: string;
}

export class SavePatientTreatmentItemDto {
  @IsNumber()
  toothNumber: number;

  @IsString()
  surface: string;

  @IsString()
  treatmentName: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsEnum(OdontogramTreatmentStatus)
  status?: OdontogramTreatmentStatus;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  treatmentId?: string;
}

export class SavePatientOdontogramDto {
  @ApiPropertyOptional({
    description: 'Teeth model: ADULT or CHILD',
    enum: TeethModel,
  })
  @IsOptional()
  @IsEnum(TeethModel)
  teethModel?: TeethModel;

  @ApiPropertyOptional({
    description: 'Clinical notes for this patient odontogram',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Complete list of active diagnostics on teeth and surfaces',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavePatientDiagnosticItemDto)
  diagnostics?: SavePatientDiagnosticItemDto[];

  @ApiPropertyOptional({
    description: 'Complete list of treatment plan procedures on teeth and surfaces',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavePatientTreatmentItemDto)
  treatments?: SavePatientTreatmentItemDto[];
}

