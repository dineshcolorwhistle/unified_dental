import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodType } from '@prisma/client';

export class QueryClinicPaymentMethodsDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  activeOnly?: boolean | string;

  @ApiProperty({
    enum: PaymentMethodType,
    required: false,
    description: 'Filter by type: INCOME (returns INCOME and BOTH), EXPENSE (returns EXPENSE and BOTH), or BOTH (exact match)',
  })
  @IsEnum(PaymentMethodType)
  @IsOptional()
  type?: PaymentMethodType;
}
