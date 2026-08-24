import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

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

