import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddIncomePaymentDto {
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  advanceUsed?: number = 0;

  @IsOptional()
  @IsString()
  advancePaymentId?: string;

  @IsOptional()
  @IsString()
  allocation?: 'SERVICES' | 'PRODUCTS' | 'BOTH' = 'BOTH';

  @IsOptional()
  @IsString()
  notes?: string;
}
