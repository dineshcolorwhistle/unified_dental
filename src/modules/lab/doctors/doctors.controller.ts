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
import { DoctorsService } from './doctors.service';
import {
  CreateDoctorDto,
  UpdateDoctorDto,
  CreateDoctorListDto,
  UpdateDoctorListDto,
  AddDoctorListMembersDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { RequireModule } from '../../../core/modules/decorators/require-module.decorator';
import { ModuleGuard } from '../../../core/modules/guards/module.guard';

@ApiTags('Dental Lab — Doctors')
@ApiBearerAuth()
@RequireModule('LAB')
@UseGuards(ModuleGuard)
@Controller('lab/doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // ══════════════════════════════════════════════════════════════
  // DOCTOR LISTS / GROUPS ENDPOINTS (placed before parameterized :id)
  // ══════════════════════════════════════════════════════════════

  @Get('lists/all')
  @ApiOperation({ summary: 'List all doctor groups / lists' })
  findAllLists(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.doctorsService.findAllLists(user.activeTenantId, user, branchId);
  }

  @Get('lists/:id')
  @ApiOperation({ summary: 'Get single doctor group with members' })
  findOneList(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.findOneList(user.activeTenantId, id, user);
  }

  @Post('lists')
  @ApiOperation({ summary: 'Create a new doctor group' })
  createList(
    @Body() dto: CreateDoctorListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.createList(dto, user.activeTenantId, user);
  }

  @Patch('lists/:id')
  @ApiOperation({ summary: 'Update doctor group details' })
  updateList(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.updateList(id, dto, user.activeTenantId, user);
  }

  @Delete('lists/:id')
  @ApiOperation({ summary: 'Delete a doctor group' })
  deleteList(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.deleteList(id, user.activeTenantId, user);
  }

  @Post('lists/:id/members')
  @ApiOperation({ summary: 'Add doctors to a group' })
  addMembers(
    @Param('id') id: string,
    @Body() dto: AddDoctorListMembersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.addMembers(id, dto.doctorIds, user.activeTenantId, user);
  }

  @Delete('lists/:id/members/:doctorId')
  @ApiOperation({ summary: 'Remove a doctor from a group' })
  removeMember(
    @Param('id') id: string,
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.removeMember(id, doctorId, user.activeTenantId, user);
  }

  // ══════════════════════════════════════════════════════════════
  // DOCTOR DIRECTORY ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  @Get()
  @ApiOperation({ summary: 'Get all Doctors (branch-scoped for Lab Admin, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.doctorsService.findAll(
      user.activeTenantId,
      user,
      branchId,
      search,
      status,
      type,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single doctor by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Doctor record (Lab Admin only — auto-assigned to Lab Admin branch)' })
  create(
    @Body() dto: CreateDoctorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Doctor details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Doctor record' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doctorsService.delete(id, user.activeTenantId, user);
  }
}
