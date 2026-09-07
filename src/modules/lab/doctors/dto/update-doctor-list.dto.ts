import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDoctorListDto {
  @ApiProperty({
    example: 'VIP Ortho Clinics',
    description: 'Updated name of the doctor list / group',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    example: 'Updated description of this doctor list',
    description: 'Updated description of this doctor list',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description: 'Doctor IDs belonging to this group',
    required: false,
    type: [String],
  })
  @IsOptional()
  doctorIds?: string[];
}
