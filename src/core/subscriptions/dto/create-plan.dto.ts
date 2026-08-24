import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  moduleCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  memberCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUploadFileSizeMb?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

