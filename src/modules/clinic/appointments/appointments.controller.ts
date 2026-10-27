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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Appointments')
@ApiBearerAuth()
@Controller('clinic/appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get KPI statistics for today appointments' })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.appointmentsService.getStats(user.activeTenantId, branchId, doctorId);
  }

  @Get()
  @ApiOperation({ summary: 'List appointments with filters and pagination' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAppointmentDto,
  ) {
    return this.appointmentsService.findAll(user.activeTenantId, query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment details by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.findOne(id, user.activeTenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new appointment (Clinic Admin only)' })
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update appointment details or reschedule (Clinic Admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, user.activeTenantId, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Quick status change for appointment (Clinic Admin only)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('cancellationReason') cancellationReason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.updateStatus(id, status, user.activeTenantId, user, cancellationReason);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete appointment (Tenant Admin only)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.remove(id, user.activeTenantId, user);
  }
}
