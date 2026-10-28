import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicWhatsappTemplatesService } from './clinic-whatsapp-templates.service';
import {
  CreateClinicWhatsappTemplateDto,
  UpdateClinicWhatsappTemplateDto,
  QueryClinicWhatsappTemplateDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — WhatsApp Templates')
@ApiBearerAuth()
@Controller('clinic/whatsapp-templates')
export class ClinicWhatsappTemplatesController {
  constructor(private readonly whatsappTemplatesService: ClinicWhatsappTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all WhatsApp templates (branch-scoped for Clinic Admin, filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryClinicWhatsappTemplateDto,
  ) {
    return this.whatsappTemplatesService.findAll(user.activeTenantId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single WhatsApp template by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappTemplatesService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new WhatsApp template' })
  create(
    @Body() dto: CreateClinicWhatsappTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappTemplatesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a WhatsApp template' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicWhatsappTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappTemplatesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a WhatsApp template' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappTemplatesService.remove(id, user.activeTenantId, user);
  }
}
