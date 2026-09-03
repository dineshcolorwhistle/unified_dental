import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProsthesisTypeDto {
  @ApiProperty({ description: 'Name of the dental prosthesis/appliance', example: 'Zirconia Crown' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Detailed description or specifications' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Base catalog unit price', example: 120.0, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number = 0;

  @ApiPropertyOptional({ description: 'Target branch ID (required if actor is Tenant Admin, auto-scoped if Lab Admin)' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Ordered list of Process IDs defining the sequential manufacturing recipe',
    type: [String],
    example: ['uuid-process-1', 'uuid-process-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  processIds?: string[];
}
