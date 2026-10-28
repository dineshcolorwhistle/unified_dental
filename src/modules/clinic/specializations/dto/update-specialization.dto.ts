import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SpecializationStatus } from '@prisma/client';

export class UpdateSpecializationDto {
  @ApiProperty({ example: 'Orthodontics', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'Dental specialty focusing on teeth alignment', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: SpecializationStatus,
    example: SpecializationStatus.ACTIVE,
    required: false,
  })
  @IsEnum(SpecializationStatus)
  @IsOptional()
  status?: SpecializationStatus;
}
