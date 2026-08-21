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
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ToggleModuleDto } from './dto/toggle-module.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Modules')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all system modules' })
  findAll(@Query('all') all?: string) {
    const includeDisabled = all !== 'false';
    return this.modulesService.findAll(includeDisabled);
  }

  @Public()
  @Get('registry')
  @ApiOperation({ summary: 'Get list of available active system modules' })
  getRegistry() {
    return this.modulesService.findAll(true);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get module details by ID' })
  findOne(@Param('id') id: string) {
    return this.modulesService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new system module (Super Admin)' })
  create(
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.create(dto, user?.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a system module name/description (Super Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.update(id, dto, user?.id);
  }

  @Patch(':id/toggle')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable a system module (Super Admin)' })
  toggleStatus(
    @Param('id') id: string,
    @Body('isEnabled') isEnabled: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.toggleStatus(id, isEnabled, user?.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a system module (Super Admin)' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.delete(id, user?.id);
  }

  @Get('tenant/:tenantId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get enabled/disabled module status for a tenant' })
  getTenantModules(@Param('tenantId') tenantId: string) {
    return this.modulesService.getTenantModules(tenantId);
  }

  @Post('toggle')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable a module for a tenant organization' })
  toggleModule(
    @Body() dto: ToggleModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.toggleModule(dto, user?.id);
  }
}
