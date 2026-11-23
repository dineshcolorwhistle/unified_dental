import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePatientAdvancePaymentDto {
  @ApiPropertyOptional({ description: 'ID of the patient (optional if provided in route URL)' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ description: 'ID of the assigned doctor (from treatment plan or null if general advance)' })
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiProperty({ description: 'Advance payment amount (positive decimal/number)', example: 1500.0 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Payment method used', example: 'CASH' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Date of payment (ISO string or YYYY-MM-DD)', example: '2026-11-23' })
  @IsOptional()
  @IsString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Optional observations or payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
