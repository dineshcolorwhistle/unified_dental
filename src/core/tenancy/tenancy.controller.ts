import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenancyService } from './tenancy.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { CurrentTenant } from '../../shared/common/decorators/current-tenant.decorator';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Tenancy')
@Controller('tenants')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Public()
  @Get('current')
  @ApiOperation({ summary: 'Get current tenant from subdomain/header context' })
  getCurrentTenant(@CurrentTenant() tenant: any) {
    return tenant || null;
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Resolve tenant information by subdomain slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.tenancyService.findBySlug(slug);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all tenants (Platform Super Admin)' })
  findAll(@Query('search') search?: string) {
    return this.tenancyService.findAll(search);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tenant details by ID' })
  findOne(@Param('id') id: string) {
    return this.tenancyService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create/Provision a new tenant organization' })
  create(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tenancyService.create(createTenantDto, user?.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update tenant metadata, status, or settings' })
  update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tenancyService.update(id, updateTenantDto, user?.id);
  }
}
