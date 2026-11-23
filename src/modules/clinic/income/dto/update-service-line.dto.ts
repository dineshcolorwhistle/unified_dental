import { IsOptional, IsInt, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  discountType?: 'PERCENTAGE' | 'FIXED';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number;
}
