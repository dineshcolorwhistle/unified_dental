import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePatientNoteDto {
  @ApiPropertyOptional({ description: 'ID of the patient (optional if provided in route URL)' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiProperty({ description: 'Date of the note (ISO string or YYYY-MM-DD)', example: '2026-11-04' })
  @IsNotEmpty()
  @IsString()
  noteDate: string;

  @ApiPropertyOptional({ description: 'Optional subject or topic to categorize the note', example: 'Routine Cleaning Checkup' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;

  @ApiProperty({ description: 'Clinical note content', example: 'Patient reports mild gingival tenderness on upper quadrant.' })
  @IsNotEmpty()
  @IsString()
  note: string;
}

