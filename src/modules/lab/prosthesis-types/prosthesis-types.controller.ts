import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProsthesisTypesService } from './prosthesis-types.service';
import { CreateProsthesisTypeDto, UpdateProsthesisTypeDto, ReorderProcessesDto } from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { RequireModule } from '../../../core/modules/decorators/require-module.decorator';
import { ModuleGuard } from '../../../core/modules/guards/module.guard';

@ApiTags('Dental Lab — Prosthesis Types')
@ApiBearerAuth()
@RequireModule('LAB')
@UseGuards(ModuleGuard)
@Controller('lab/prosthesis-types')
export class ProsthesisTypesController {
  constructor(private readonly prosthesisTypesService: ProsthesisTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Prosthesis Types (branch-scoped for Lab Admin, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.prosthesisTypesService.findAll(user.activeTenantId, user, branchId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Prosthesis Type by ID with ordered steps' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prosthesisTypesService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Prosthesis Type with recipe steps (Lab Admin auto-assigned, Tenant Admin selectable)' })
  create(
    @Body() dto: CreateProsthesisTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prosthesisTypesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Prosthesis Type info and recipe steps (Lab Admin scoped to branch, Tenant Admin any)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProsthesisTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prosthesisTypesService.update(id, dto, user.activeTenantId, user);
  }

  @Put(':id/reorder')
  @ApiOperation({ summary: 'Reorder workflow sequence steps for a Prosthesis Type' })
  reorderProcesses(
    @Param('id') id: string,
    @Body() dto: ReorderProcessesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prosthesisTypesService.reorderProcesses(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Prosthesis Type (Tenant Admin only)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prosthesisTypesService.remove(id, user.activeTenantId, user);
  }
}
