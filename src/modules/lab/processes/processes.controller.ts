import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProcessesService } from './processes.service';
import { CreateProcessDto, UpdateProcessDto } from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { RequireModule } from '../../../core/modules/decorators/require-module.decorator';
import { ModuleGuard } from '../../../core/modules/guards/module.guard';
import { ProcessType } from '@prisma/client';

@ApiTags('Dental Lab — Processes')
@ApiBearerAuth()
@RequireModule('LAB')
@UseGuards(ModuleGuard)
@Controller('lab/processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Processes (branch-scoped for Lab Admin, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('processAreaId') processAreaId?: string,
    @Query('type') type?: ProcessType,
    @Query('search') search?: string,
  ) {
    return this.processesService.findAll(user.activeTenantId, user, branchId, processAreaId, type, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Process by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processesService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Process (Lab Admin auto-assigned, Tenant Admin selectable)' })
  create(
    @Body() dto: CreateProcessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Process (Lab Admin scoped to branch, Tenant Admin any)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProcessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Process (Tenant Admin only — validates no linked prosthesis recipes)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processesService.remove(id, user.activeTenantId, user);
  }
}
