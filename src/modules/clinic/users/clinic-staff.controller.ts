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
import { ClinicUsersService } from './clinic-users.service';
import { CreateClinicStaffDto } from './dto/create-clinic-staff.dto';
import { UpdateClinicStaffDto } from './dto/update-clinic-staff.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Staff Members')
@ApiBearerAuth()
@Controller('clinic/users/staff')
export class ClinicStaffController {
  constructor(private readonly clinicUsersService: ClinicUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get Clinic Staff (scoped to branch for Clinic Admin, all branches for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.clinicUsersService.findAllClinicStaff(user.activeTenantId, user, branchId, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Clinic Staff member (Clinic Admin only — auto-assigned to Clinic Admin branch)' })
  create(
    @Body() dto: CreateClinicStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.createClinicStaff(dto, user.activeTenantId, user);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend password reset welcome email to Clinic Staff' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.resendStaffInvite(id, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Clinic Staff profile (Clinic Admin only — scoped to branch)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.updateClinicStaff(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Clinic Staff from branch' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.deleteClinicStaff(id, user.activeTenantId, user);
  }
}
