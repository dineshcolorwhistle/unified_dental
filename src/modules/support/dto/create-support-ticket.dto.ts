import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty({ description: 'Title or name of the support ticket', example: 'Issue syncing work order scan files' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Detailed description of the issue or inquiry' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Array of image URLs or file descriptors (max 2 images)',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  images?: Array<{
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
  }>;

  @ApiPropertyOptional({ description: 'Optional specific branch ID override' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
