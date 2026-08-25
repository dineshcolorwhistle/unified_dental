import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { BranchStatus } from '@prisma/client';

export class CreateBranchDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
