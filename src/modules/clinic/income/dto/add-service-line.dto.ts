import { IsNotEmpty, IsString, IsOptional, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddServiceLineDto {
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  discountType?: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number = 0;
}
