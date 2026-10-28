import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WhatsappTemplateStatus } from '@prisma/client';

export class QueryClinicWhatsappTemplateDto {
  @ApiProperty({ required: false, description: 'Search by template name or message text' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    enum: WhatsappTemplateStatus,
    required: false,
    description: 'Filter by template status',
  })
  @IsEnum(WhatsappTemplateStatus)
  @IsOptional()
  status?: WhatsappTemplateStatus;

  @ApiProperty({ required: false, description: 'Filter by branch ID' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
