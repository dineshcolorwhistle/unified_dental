import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProcessType } from '@prisma/client';

export class CreateProcessDto {
  @ApiProperty({ description: 'Name of the process/step', example: 'CAD Design & Modeling' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Type of process',
    enum: ProcessType,
    default: ProcessType.PRODUCTION,
  })
  @IsEnum(ProcessType)
  @IsOptional()
  type?: ProcessType = ProcessType.PRODUCTION;

  @ApiProperty({ description: 'Process Area ID to group this process under', example: 'uuid' })
  @IsString()
  @IsNotEmpty({ message: 'Process Area is mandatory' })
  @IsUUID('4', { message: 'Process Area ID must be a valid UUID' })
  processAreaId: string;

  @ApiPropertyOptional({ description: 'Default assigned technician or lab admin user ID' })
  @IsString()
  @IsOptional()
  defaultTechnicianId?: string;

  @ApiPropertyOptional({ description: 'Target branch ID (required if actor is Tenant Admin, auto-scoped if Lab Admin)' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
