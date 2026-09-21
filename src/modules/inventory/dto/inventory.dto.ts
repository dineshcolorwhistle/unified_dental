import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductType {
  FOR_USE = 'FOR_USE',
  FOR_SALE = 'FOR_SALE',
  RAW_MATERIAL = 'RAW_MATERIAL',
  EQUIPMENT = 'EQUIPMENT',
}

export enum CategoryStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum InventoryItemStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED',
}

// ─── Inventory Category DTOs ───

export class CreateInventoryCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Acrílico Autocurable' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Product type classification',
    enum: ProductType,
    default: ProductType.FOR_USE,
  })
  @IsString()
  @IsOptional()
  productType?: string = ProductType.FOR_USE;

  @ApiPropertyOptional({
    description: 'Category status',
    enum: CategoryStatus,
    default: CategoryStatus.ACTIVE,
  })
  @IsString()
  @IsOptional()
  status?: string = CategoryStatus.ACTIVE;

  @ApiPropertyOptional({ description: 'Detailed description of the category' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Branch ID override (Tenant Admin only)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key (e.g. LAB, CLINIC)', default: 'LAB' })
  @IsString()
  @IsOptional()
  moduleKey?: string = 'LAB';
}

export class UpdateInventoryCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Product type classification', enum: ProductType })
  @IsString()
  @IsOptional()
  productType?: string;

  @ApiPropertyOptional({ description: 'Category status', enum: CategoryStatus })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Detailed description of the category' })
  @IsString()
  @IsOptional()
  description?: string;
}

// ─── Inventory Item DTOs ───

export class CreateInventoryItemDto {
  @ApiProperty({ description: 'Item name', example: 'Polímero Acrílico Rosa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'SKU code (auto-generated if omitted)', example: 'INV-20260921-9583' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Category ID', example: 'd3b07384-d113-40e9-9a2c-e160e1d13735' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Stock status',
    enum: InventoryItemStatus,
    default: InventoryItemStatus.IN_STOCK,
  })
  @IsString()
  @IsOptional()
  status?: string = InventoryItemStatus.IN_STOCK;

  @ApiProperty({ description: 'Current in-stock quantity', example: 10, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number = 0;

  @ApiPropertyOptional({ description: 'Minimum quantity threshold for low stock alert', example: 5, default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number = 5;

  @ApiProperty({ description: 'Unit price', example: 350.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number = 0;

  @ApiPropertyOptional({ description: 'Brand or manufacturer', example: 'Nic Tone' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Supplier name', example: 'Depósito Dental Central' })
  @IsString()
  @IsOptional()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Expiry date (YYYY-MM-DD or ISO)', example: '2027-12-31' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Detailed description or notes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Branch ID override (Tenant Admin only)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key (e.g. LAB, CLINIC)', default: 'LAB' })
  @IsString()
  @IsOptional()
  moduleKey?: string = 'LAB';
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ description: 'Item name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'SKU code' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Stock status', enum: InventoryItemStatus })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Current in-stock quantity' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Minimum quantity threshold' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Unit price' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Brand' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Supplier' })
  @IsString()
  @IsOptional()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}

export class QueryInventoryItemsDto {
  @ApiPropertyOptional({ description: 'Search term for name, SKU, brand, supplier' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Category ID filter' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Stock status filter', enum: InventoryItemStatus })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter only low stock items (quantity <= minQuantity)' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  lowStockOnly?: boolean;

  @ApiPropertyOptional({ description: 'Branch ID filter (or "all")' })
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
