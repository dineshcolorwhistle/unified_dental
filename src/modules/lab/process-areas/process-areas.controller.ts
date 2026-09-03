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
import { ProcessAreasService } from './process-areas.service';
import { CreateProcessAreaDto, UpdateProcessAreaDto } from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { RequireModule } from '../../../core/modules/decorators/require-module.decorator';
import { ModuleGuard } from '../../../core/modules/guards/module.guard';

@ApiTags('Dental Lab — Process Areas')
@ApiBearerAuth()
@RequireModule('LAB')
@UseGuards(ModuleGuard)
@Controller('lab/process-areas')
export class ProcessAreasController {
  constructor(private readonly processAreasService: ProcessAreasService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Process Areas (branch-scoped for Lab Admin, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.processAreasService.findAll(user.activeTenantId, user, branchId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Process Area by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processAreasService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Process Area (Lab Admin auto-assigned, Tenant Admin selectable)' })
  create(
    @Body() dto: CreateProcessAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processAreasService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Process Area (Lab Admin scoped to branch, Tenant Admin any)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProcessAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processAreasService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Process Area (Tenant Admin only — validates no linked processes)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processAreasService.remove(id, user.activeTenantId, user);
  }
}
