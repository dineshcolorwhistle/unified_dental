import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLabAdminDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

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
  phoneNumber?: string; // e.g. '55 1234 5678'

  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsOptional()
  @IsBoolean()
  isDefaultAdmin?: boolean;
}
