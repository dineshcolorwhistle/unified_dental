import { PartialType } from '@nestjs/swagger';
import { CreateClinicWhatsappTemplateDto } from './create-clinic-whatsapp-template.dto';

export class UpdateClinicWhatsappTemplateDto extends PartialType(CreateClinicWhatsappTemplateDto) {}
