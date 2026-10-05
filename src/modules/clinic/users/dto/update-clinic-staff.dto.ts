import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateClinicStaffDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  roleTitle?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
