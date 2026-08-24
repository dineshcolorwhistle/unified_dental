import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. smile-lab)',
  })
  slug: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsString()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
