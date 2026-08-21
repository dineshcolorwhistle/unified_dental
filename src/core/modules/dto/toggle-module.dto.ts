import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ToggleModuleDto {
  @IsNotEmpty()
  @IsString()
  tenantId: string;

  @IsNotEmpty()
  @IsString()
  moduleKey: string;

  @IsNotEmpty()
  @IsBoolean()
  isEnabled: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
