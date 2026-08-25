import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
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

  @IsNotEmpty({ message: 'Initial administrator email is required' })
  @IsEmail({}, { message: 'Invalid administrator email format' })
  adminEmail: string;

  @IsNotEmpty({ message: 'Initial administrator name is required' })
  @IsString()
  adminName: string;

  @IsOptional()
  @IsString()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
