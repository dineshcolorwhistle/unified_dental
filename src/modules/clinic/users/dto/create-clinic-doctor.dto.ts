import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DoctorServiceAssignmentDto } from './doctor-service-assignment.dto';

export class CreateClinicDoctorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneCountryCode?: string; // e.g. '+52'

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  specialization?: string; // e.g. 'General Practice', 'Cardiology', 'Pediatrics', 'Dentistry'

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DoctorServiceAssignmentDto)
  services?: DoctorServiceAssignmentDto[];
}

