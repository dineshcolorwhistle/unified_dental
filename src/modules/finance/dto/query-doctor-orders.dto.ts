import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDoctorOrdersDto {
  @ApiPropertyOptional({ description: 'Filter: "pending" or "all"', default: 'all' })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({ description: 'Branch ID or "all" for all branches' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Module key (e.g. LAB, CLINIC)' })
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
