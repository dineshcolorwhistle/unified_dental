import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';

export class QueryServicesDto {
  @ApiProperty({ required: false, description: 'Search by name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    enum: ServiceStatus,
    required: false,
    description: 'Filter by status',
  })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @ApiProperty({ required: false, description: 'Filter by branch ID (for Tenant Admins)' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
