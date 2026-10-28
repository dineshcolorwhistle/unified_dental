import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SpecializationStatus } from '@prisma/client';

export class QuerySpecializationsDto {
  @ApiProperty({ required: false, description: 'Search by name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    enum: SpecializationStatus,
    required: false,
    description: 'Filter by status',
  })
  @IsEnum(SpecializationStatus)
  @IsOptional()
  status?: SpecializationStatus;
}
