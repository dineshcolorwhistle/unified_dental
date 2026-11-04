import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodType } from '@prisma/client';

export class CreateClinicPaymentMethodDto {
  @ApiProperty({ example: 'Cash', description: 'Name of the payment method' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Standard cash payment at clinic reception', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: PaymentMethodType,
    example: PaymentMethodType.BOTH,
    default: PaymentMethodType.BOTH,
    required: false,
    description: 'Payment method type: INCOME, EXPENSE, or BOTH',
  })
  @IsEnum(PaymentMethodType)
  @IsOptional()
  type?: PaymentMethodType;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
