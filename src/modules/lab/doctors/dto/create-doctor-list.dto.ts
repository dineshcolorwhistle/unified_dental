import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDoctorListDto {
  @ApiProperty({
    example: 'VIP Ortho Clinics',
    description: 'Name of the doctor list / group',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'High-priority orthodontic clinics with rapid turnaround',
    description: 'Description of this doctor list',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID (optional, auto-forced for Lab Admin)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description: 'Initial doctor IDs to add to this group',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  doctorIds?: string[];
}
