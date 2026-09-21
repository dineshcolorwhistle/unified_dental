import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseCategoryDto {
  @ApiProperty({ description: 'Expense category name', example: 'ACRILICO' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Detailed description of the category' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional branch ID override (Tenant Admin only)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key', default: 'LAB' })
  @IsString()
  @IsOptional()
  moduleKey?: string;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional({ description: 'Expense category name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Detailed description of the category' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ description: 'Expense title / concept', example: 'Material Acrílico Polímero' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Category ID', example: 'd3b07384-d113-40e9-9a2c-e160e1d13735' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Expense amount', example: 1250.50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Date of the expense (YYYY-MM-DD or ISO)', example: '2026-09-21' })
  @IsDateString()
  @IsNotEmpty()
  expenseDate: string;

  @ApiProperty({ description: 'Payment method used', example: 'BBVA Crédito' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Detailed description or notes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Branch ID (Tenant Admin selectable; auto-resolved for Lab Admin)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key', default: 'LAB' })
  @IsString()
  @IsOptional()
  moduleKey?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ description: 'Expense title / concept' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Expense amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Date of the expense' })
  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @ApiPropertyOptional({ description: 'Payment method used' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Detailed description or notes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Branch ID (Tenant Admin only)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}

export class QueryExpensesDto {
  @ApiPropertyOptional({ description: 'Search term for title and description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Expense Category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Start Date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End Date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Branch ID filter (Tenant Admin can pass branch ID or "all")' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key filter', default: 'LAB' })
  @IsString()
  @IsOptional()
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  limit?: number = 20;
}
