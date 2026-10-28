import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WhatsappTemplateStatus } from '@prisma/client';

export class CreateClinicWhatsappTemplateDto {
  @ApiProperty({ example: 'Appointment Reminder', description: 'Name of the WhatsApp template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example:
      'Hello {patient_name}, your appointment at {site_name} is confirmed. Contact us at {phone} for questions.',
    description: 'WhatsApp message body with placeholder tags ({patient_name}, {site_name}, {phone})',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    enum: WhatsappTemplateStatus,
    example: WhatsappTemplateStatus.ACTIVE,
    required: false,
    default: WhatsappTemplateStatus.ACTIVE,
  })
  @IsEnum(WhatsappTemplateStatus)
  @IsOptional()
  status?: WhatsappTemplateStatus;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
