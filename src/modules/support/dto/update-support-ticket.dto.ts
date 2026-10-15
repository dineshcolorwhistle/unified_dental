import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({ description: 'Updated title of the support ticket' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Updated description of the support ticket' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated array of image URLs or file descriptors (maximum 2 images)',
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
}
