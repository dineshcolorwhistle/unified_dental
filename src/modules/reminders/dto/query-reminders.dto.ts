import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderPriority, ReminderRecurrence } from '@prisma/client';

export class QueryRemindersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search title, category, description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ReminderPriority })
  @IsOptional()
  @IsEnum(ReminderPriority)
  priority?: ReminderPriority;

  @ApiPropertyOptional({ enum: ReminderRecurrence })
  @IsOptional()
  @IsEnum(ReminderRecurrence)
  recurrence?: ReminderRecurrence;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by branchId' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by moduleKey' })
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsString()
  status?: string; // 'active', 'all', 'inactive'
}
