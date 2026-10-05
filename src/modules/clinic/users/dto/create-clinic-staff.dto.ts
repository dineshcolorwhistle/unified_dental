import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClinicStaffDto {
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
  roleTitle?: string; // e.g. "Receptionist", "Dental Assistant", "Hygienist"
}
