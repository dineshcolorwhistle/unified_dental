import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClinicDoctorDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

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
  specialization?: string; // e.g. 'General Dentistry', 'Orthodontics', 'Endodontics', 'Periodontics', 'Oral Surgery'

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
