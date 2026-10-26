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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Patients')
@ApiBearerAuth()
@Controller('clinic/patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get KPI statistics for Clinic Patients' })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.patientsService.getStats(user.activeTenantId, branchId);
  }

  @Get()
  @ApiOperation({ summary: 'List Clinic Patients with search and pagination' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPatientDto,
  ) {
    return this.patientsService.findAll(user.activeTenantId, query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Clinic Patient details by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.findOne(id, user.activeTenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new Clinic Patient' })
  create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Clinic Patient record' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Clinic Patient record' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.remove(id, user.activeTenantId, user);
  }
}
