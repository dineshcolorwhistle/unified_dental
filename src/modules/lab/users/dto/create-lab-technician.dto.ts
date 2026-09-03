import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLabTechnicianDto {
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
  phoneNumber?: string; // e.g. '55 1234 5678'
}
