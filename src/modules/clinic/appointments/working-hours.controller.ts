import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  UpdateClinicWorkingHoursDto,
  UpdateDoctorWorkingHoursDto,
} from './dto/working-hours.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Working Hours')
@ApiBearerAuth()
@Controller('clinic/appointments/working-hours')
export class WorkingHoursController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ── Clinic Working Hours ──────────────────────────────────────────────────

  @Get('clinic')
  @ApiOperation({ summary: 'Get clinic operating hours for a branch' })
  async getClinicHours(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    const schedule = await this.appointmentsService.getClinicWorkingHours(user.activeTenantId, branchId);
    return { schedule };
  }

  @Put('clinic')
  @ApiOperation({ summary: 'Save/update clinic operating hours (Clinic Admin only)' })
  updateClinicHours(
    @Body() dto: UpdateClinicWorkingHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.updateClinicWorkingHours(dto, user.activeTenantId, user);
  }

  // ── Doctor Working Hours ──────────────────────────────────────────────────

  @Get('doctors')
  @ApiOperation({ summary: 'List clinic doctors with their schedule summary' })
  getDoctors(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.appointmentsService.getDoctorsWithSchedule(user.activeTenantId, branchId);
  }

  @Get('doctors/:doctorId')
  @ApiOperation({ summary: 'Get individual doctor 7-day schedule' })
  async getDoctorHours(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    const schedule = await this.appointmentsService.getDoctorWorkingHours(user.activeTenantId, doctorId, branchId);
    return { schedule };
  }

  @Put('doctors/:doctorId')
  @ApiOperation({ summary: 'Save/update doctor working hours (Clinic Admin only)' })
  updateDoctorHours(
    @Param('doctorId') doctorId: string,
    @Body() dto: UpdateDoctorWorkingHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.updateDoctorWorkingHours(doctorId, dto, user.activeTenantId, user);
  }

  // ── Available Slots ───────────────────────────────────────────────────────

  @Get('available-slots')
  @ApiOperation({ summary: 'Get available appointment time slots for a doctor on a specific date' })
  getAvailableSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('durationMinutes') durationMinutes?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      user.activeTenantId,
      doctorId,
      date,
      durationMinutes ? parseInt(durationMinutes, 10) : 30,
      branchId,
    );
  }
}
