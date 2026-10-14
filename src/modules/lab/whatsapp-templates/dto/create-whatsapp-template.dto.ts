import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WhatsappTemplateStatus } from '@prisma/client';

export class CreateWhatsappTemplateDto {
  @ApiProperty({ example: 'External Verification Reminder', description: 'Name of the WhatsApp template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: WhatsappTemplateStatus,
    example: WhatsappTemplateStatus.ACTIVE,
    required: false,
    default: WhatsappTemplateStatus.ACTIVE,
  })
  @IsEnum(WhatsappTemplateStatus)
  @IsOptional()
  status?: WhatsappTemplateStatus;

  @ApiProperty({
    example:
      'Hello {doctor_name}, work order #{workorder_number} (Folio: {folio_number}, Box: {boxnumber}) requires verification: {verification_link}',
    description: 'WhatsApp message body with placeholder tags',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
