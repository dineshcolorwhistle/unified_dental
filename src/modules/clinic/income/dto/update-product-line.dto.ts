import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProductLineDto {
  @ApiProperty({ description: 'Updated quantity of the product' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit price of the product' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
