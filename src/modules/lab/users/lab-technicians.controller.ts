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
import { LabUsersService } from './lab-users.service';
import { CreateLabTechnicianDto } from './dto/create-lab-technician.dto';
import { UpdateLabTechnicianDto } from './dto/update-lab-technician.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Lab — Users & Technicians')
@ApiBearerAuth()
@Controller('lab/users/technicians')
export class LabTechniciansController {
  constructor(private readonly labUsersService: LabUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get Lab Technicians (scoped to branch for Lab Admin, all branches for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.labUsersService.findAllLabTechnicians(user.activeTenantId, user, branchId, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Lab Technician (Lab Admin only — auto-assigned to Lab Admin branch)' })
  create(
    @Body() dto: CreateLabTechnicianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.createLabTechnician(dto, user.activeTenantId, user);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend password reset welcome email to Lab Technician' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.resendTechnicianInvite(id, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Lab Technician profile (Lab Admin only — scoped to branch)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLabTechnicianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.updateLabTechnician(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Lab Technician from organization (Tenant Admin only)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.deleteLabTechnician(id, user.activeTenantId, user);
  }
}
