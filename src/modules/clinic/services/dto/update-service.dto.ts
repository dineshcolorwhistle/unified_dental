import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ServiceStatus } from '@prisma/client';

export class UpdateServiceDto {
  @ApiProperty({ example: 'Dental Cleaning', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @ApiProperty({ example: 'Professional teeth cleaning and polishing', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 500.00, required: false })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  price?: number;

  @ApiProperty({
    enum: ServiceStatus,
    example: ServiceStatus.ACTIVE,
    required: false,
  })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
