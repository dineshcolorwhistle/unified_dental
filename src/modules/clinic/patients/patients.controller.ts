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
import { CreatePatientNoteDto } from './dto/create-patient-note.dto';
import { QueryPatientNoteDto } from './dto/query-patient-note.dto';
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

  @Post('notes')
  @ApiOperation({ summary: 'Add a new clinical note with patientId in body' })
  createNote(
    @Body() dto: CreatePatientNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.createNote(user.activeTenantId, user, dto);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a new clinical note for a specific patient' })
  createNoteForPatient(
    @Param('id') id: string,
    @Body() dto: CreatePatientNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.createNote(user.activeTenantId, user, dto, id);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Get clinical history notes for a patient' })
  findPatientNotes(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPatientNoteDto,
  ) {
    return this.patientsService.findPatientNotes(user.activeTenantId, id, query);
  }

  @Delete(':patientId/notes/:noteId')
  @ApiOperation({ summary: 'Delete a clinical note (Author or Tenant Admin)' })
  deletePatientNote(
    @Param('patientId') patientId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.deletePatientNote(user.activeTenantId, patientId, noteId, user);
  }
}
