import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProcessAreaDto {
  @ApiProperty({ description: 'Name of the process area (department/workstation)', example: 'CAD / CAM Design' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Description or equipment notes for this area' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Target branch ID (required if actor is Tenant Admin, auto-scoped if Lab Admin)' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
