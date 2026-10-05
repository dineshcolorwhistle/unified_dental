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
import { CreateClinicAdminDto } from './dto/create-clinic-admin.dto';
import { UpdateClinicAdminDto } from './dto/update-clinic-admin.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Users & Admins')
@ApiBearerAuth()
@Controller('clinic/users/admin')
export class ClinicAdminController {
  constructor(private readonly clinicUsersService: ClinicUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Clinic Administrators in current organization' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.clinicUsersService.findAllClinicAdmins(user.activeTenantId, branchId, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Clinic Administrator (Tenant Admin only)' })
  create(
    @Body() dto: CreateClinicAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.createClinicAdmin(dto, user.activeTenantId, user);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend password reset welcome email to Clinic Administrator' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.resendAdminInvite(id, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Clinic Administrator profile and branch assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.updateClinicAdmin(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Clinic Administrator from organization' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.deleteClinicAdmin(id, user.activeTenantId, user);
  }
}
