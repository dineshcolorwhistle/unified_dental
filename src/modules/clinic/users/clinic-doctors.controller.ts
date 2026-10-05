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
import { CreateClinicDoctorDto } from './dto/create-clinic-doctor.dto';
import { UpdateClinicDoctorDto } from './dto/update-clinic-doctor.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Doctors & Specialists')
@ApiBearerAuth()
@Controller('clinic/users/doctors')
export class ClinicDoctorsController {
  constructor(private readonly clinicUsersService: ClinicUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get Clinic Doctors (scoped to branch for Clinic Admin, all branches for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.clinicUsersService.findAllClinicDoctors(user.activeTenantId, user, branchId, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Clinic Doctor (Clinic Admin only — auto-assigned to Clinic Admin branch)' })
  create(
    @Body() dto: CreateClinicDoctorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.createClinicDoctor(dto, user.activeTenantId, user);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend password reset welcome email to Clinic Doctor' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.resendDoctorInvite(id, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Clinic Doctor profile and specialization (Clinic Admin only — scoped to branch)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicDoctorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.updateClinicDoctor(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Clinic Doctor from clinic' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicUsersService.deleteClinicDoctor(id, user.activeTenantId, user);
  }
}
