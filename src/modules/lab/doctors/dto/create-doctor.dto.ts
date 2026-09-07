import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DoctorTypeDto {
  LOCAL = 'LOCAL',
  INTEGRATED = 'INTEGRATED',
}

export class CreateDoctorDto {
  @ApiProperty({
    example: 'Dr. John Watson',
    description: 'Name of the doctor/dentist',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

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
    description: 'Doctor type: LOCAL (created via lab app) or INTEGRATED (synced via API)',
    required: false,
    default: DoctorTypeDto.LOCAL,
  })
  @IsEnum(DoctorTypeDto)
  @IsOptional()
  type?: DoctorTypeDto;
}
