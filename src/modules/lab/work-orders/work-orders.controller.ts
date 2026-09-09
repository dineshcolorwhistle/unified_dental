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
import { WorkOrdersService } from './work-orders.service';
import { AddWorkOrderNoteDto, CreateWorkOrderDto, QueryWorkOrdersDto, UpdateWorkOrderDto } from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { RequireModule } from '../../../core/modules/decorators/require-module.decorator';
import { ModuleGuard } from '../../../core/modules/guards/module.guard';

@ApiTags('Dental Lab — Work Orders')
@ApiBearerAuth()
@RequireModule('LAB')
@UseGuards(ModuleGuard)
@Controller('lab/work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get('next-folio')
  @ApiOperation({ summary: 'Preview next sequential folio number for branch' })
  getNextFolio(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.workOrdersService.getNextFolioPreview(user.activeTenantId, user, branchId);
  }

  @Get()
  @ApiOperation({ summary: 'List all work orders with filtering, search, and pagination' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryWorkOrdersDto,
  ) {
    return this.workOrdersService.findAll(user.activeTenantId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific work order including processes and notes' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.findOne(user.activeTenantId, user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new work order (Restricted to Lab Administrators)' })
  create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.create(user.activeTenantId, user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a work order (Restricted to Lab Administrators)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.update(user.activeTenantId, user, id, dto);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a new note to work order history' })
  addNote(
    @Param('id') id: string,
    @Body() dto: AddWorkOrderNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.addNote(user.activeTenantId, user, id, dto.note);
  }

  @Patch(':id/notes/:noteId')
  @ApiOperation({ summary: 'Update a work order note (Admins, or author technician)' })
  updateNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() dto: AddWorkOrderNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.updateNote(user.activeTenantId, user, id, noteId, dto.note);
  }

  @Delete(':id/notes/:noteId')
  @ApiOperation({ summary: 'Delete a work order note (Admins, or author technician)' })
  deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.deleteNote(user.activeTenantId, user, id, noteId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a work order (Restricted to Platform and Tenant Administrators)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.remove(user.activeTenantId, user, id);
  }
}
