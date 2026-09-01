import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  price?: number | null;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  maxBranches?: number | null;

  @IsOptional()
  maxMembers?: number | null;

  @IsOptional()
  maxUploadFileSizeMb?: number | null;

  @IsOptional()
  maxModules?: number | null;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

