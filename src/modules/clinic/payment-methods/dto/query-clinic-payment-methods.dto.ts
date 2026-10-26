import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
