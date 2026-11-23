import { IsNotEmpty, IsString, IsOptional, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddProductLineDto {
  @IsNotEmpty()
  @IsString()
  inventoryItemId: string;

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
}
