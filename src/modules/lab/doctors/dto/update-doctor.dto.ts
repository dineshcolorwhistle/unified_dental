import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DoctorTypeDto } from './create-doctor.dto';

export class UpdateDoctorDto {
  @ApiProperty({
    example: 'Dr. John Watson',
    description: 'Name of the doctor/dentist',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    example: 'Baker Street Dental Clinic',
    description: 'Name of the dental clinic',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  clinicName?: string;

  @ApiProperty({
    example: 'john.watson@example.com',
    description: 'Email address of the doctor',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+52 55 1234 5678',
    description: 'Contact phone number of the doctor',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'Av. Insurgentes Sur 123, Col. Roma, CDMX',
    description: 'Physical address of the doctor or clinic',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: 'Orthodontics',
    description: 'Specialization or department',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specialization?: string;

  @ApiProperty({
    enum: DoctorTypeDto,
    example: DoctorTypeDto.LOCAL,
    description: 'Doctor type: LOCAL or INTEGRATED',
    required: false,
  })
  @IsEnum(DoctorTypeDto)
  @IsOptional()
  type?: DoctorTypeDto;

  @ApiProperty({
    example: true,
    description: 'Active status of the doctor',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
