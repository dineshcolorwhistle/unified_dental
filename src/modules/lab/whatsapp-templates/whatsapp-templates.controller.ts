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
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import {
  CreateWhatsappTemplateDto,
  UpdateWhatsappTemplateDto,
  QueryWhatsappTemplatesDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Lab — WhatsApp Templates')
@ApiBearerAuth()
@Controller('lab/whatsapp-templates')
export class WhatsappTemplatesController {
  constructor(private readonly whatsappTemplatesService: WhatsappTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all WhatsApp templates (branch-scoped for Lab Admin, filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryWhatsappTemplatesDto,
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
    @Body() dto: CreateWhatsappTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappTemplatesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a WhatsApp template' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsappTemplateDto,
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
