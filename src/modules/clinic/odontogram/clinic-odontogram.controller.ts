import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicOdontogramService } from './clinic-odontogram.service';
import {
  UpdateOdontogramConfigDto,
  CreateOdontogramTreatmentDto,
  UpdateOdontogramTreatmentDto,
  CreateOdontogramDiagnosticDto,
  UpdateOdontogramDiagnosticDto,
  UpdatePatientOdontogramDto,
  AddPatientDiagnosticDto,
  UpdatePatientDiagnosticDto,
  AddPatientTreatmentDto,
  UpdatePatientTreatmentDto,
  SavePatientOdontogramDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Odontogram')
@ApiBearerAuth()
@Controller('clinic/odontogram')
export class ClinicOdontogramController {
  constructor(private readonly odontogramService: ClinicOdontogramService) {}

  // ─── Config Endpoints ────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Get odontogram default configuration for clinic' })
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.odontogramService.getConfig(user.activeTenantId, user, branchId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update default odontogram configuration for clinic' })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOdontogramConfigDto,
  ) {
    return this.odontogramService.updateConfig(user.activeTenantId, user, dto);
  }

  // ─── Treatments Endpoints ────────────────────────────────

  @Get('treatments')
  @ApiOperation({ summary: 'List all clinic odontogram treatments' })
  findAllTreatments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.odontogramService.findAllTreatments(user.activeTenantId, user, branchId);
  }

  @Post('treatments')
  @ApiOperation({ summary: 'Create a new clinic odontogram treatment' })
  createTreatment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOdontogramTreatmentDto,
  ) {
    return this.odontogramService.createTreatment(user.activeTenantId, user, dto);
  }

  @Patch('treatments/:id')
  @ApiOperation({ summary: 'Update a clinic odontogram treatment' })
  updateTreatment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOdontogramTreatmentDto,
  ) {
    return this.odontogramService.updateTreatment(id, user.activeTenantId, user, dto);
  }

  @Delete('treatments/:id')
  @ApiOperation({ summary: 'Delete a clinic odontogram treatment (Tenant Admin only)' })
  removeTreatment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.removeTreatment(id, user.activeTenantId, user);
  }

  // ─── Diagnostics Endpoints ───────────────────────────────

  @Get('diagnostics')
  @ApiOperation({ summary: 'List all clinic odontogram diagnostics' })
  findAllDiagnostics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.odontogramService.findAllDiagnostics(user.activeTenantId, user, branchId);
  }

  @Post('diagnostics')
  @ApiOperation({ summary: 'Create a new clinic odontogram diagnostic' })
  createDiagnostic(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOdontogramDiagnosticDto,
  ) {
    return this.odontogramService.createDiagnostic(user.activeTenantId, user, dto);
  }

  @Patch('diagnostics/:id')
  @ApiOperation({ summary: 'Update a clinic odontogram diagnostic' })
  updateDiagnostic(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOdontogramDiagnosticDto,
  ) {
    return this.odontogramService.updateDiagnostic(id, user.activeTenantId, user, dto);
  }

  @Delete('diagnostics/:id')
  @ApiOperation({ summary: 'Delete a clinic odontogram diagnostic (Tenant Admin only)' })
  removeDiagnostic(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.removeDiagnostic(id, user.activeTenantId, user);
  }

  // ─── Patient Odontogram Endpoints ────────────────────────

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient odontogram, teeth diagnostics, and treatment plan' })
  getPatientOdontogram(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.getPatientOdontogram(user.activeTenantId, patientId, user);
  }

  @Patch('patient/:patientId')
  @ApiOperation({ summary: 'Update patient odontogram model and notes' })
  updatePatientOdontogram(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePatientOdontogramDto,
  ) {
    return this.odontogramService.updatePatientOdontogram(user.activeTenantId, patientId, user, dto);
  }

  @Post('patient/:patientId/diagnostics')
  @ApiOperation({ summary: 'Add a diagnostic finding to patient tooth or surface' })
  addPatientDiagnostic(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPatientDiagnosticDto,
  ) {
    return this.odontogramService.addPatientDiagnostic(user.activeTenantId, patientId, user, dto);
  }

  @Patch('patient/:patientId/diagnostics/:diagnosticId')
  @ApiOperation({ summary: 'Update a patient diagnostic finding' })
  updatePatientDiagnostic(
    @Param('patientId') patientId: string,
    @Param('diagnosticId') diagnosticId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePatientDiagnosticDto,
  ) {
    return this.odontogramService.updatePatientDiagnostic(
      user.activeTenantId,
      patientId,
      diagnosticId,
      user,
      dto,
    );
  }

  @Delete('patient/:patientId/diagnostics/:diagnosticId')
  @ApiOperation({ summary: 'Delete a patient diagnostic finding' })
  removePatientDiagnostic(
    @Param('patientId') patientId: string,
    @Param('diagnosticId') diagnosticId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.removePatientDiagnostic(
      user.activeTenantId,
      patientId,
      diagnosticId,
      user,
    );
  }

  @Post('patient/:patientId/treatments')
  @ApiOperation({ summary: 'Add a treatment plan procedure to patient tooth or surface' })
  addPatientTreatment(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPatientTreatmentDto,
  ) {
    return this.odontogramService.addPatientTreatment(user.activeTenantId, patientId, user, dto);
  }

  @Patch('patient/:patientId/treatments/:treatmentId')
  @ApiOperation({ summary: 'Update a patient treatment plan procedure' })
  updatePatientTreatment(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePatientTreatmentDto,
  ) {
    return this.odontogramService.updatePatientTreatment(
      user.activeTenantId,
      patientId,
      treatmentId,
      user,
      dto,
    );
  }

  @Delete('patient/:patientId/treatments/:treatmentId')
  @ApiOperation({ summary: 'Delete a patient treatment plan procedure' })
  removePatientTreatment(
    @Param('patientId') patientId: string,
    @Param('treatmentId') treatmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.removePatientTreatment(
      user.activeTenantId,
      patientId,
      treatmentId,
      user,
    );
  }

  @Post('patient/:patientId/save')
  @ApiOperation({ summary: 'Save full patient odontogram state atomically' })
  savePatientOdontogram(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePatientOdontogramDto,
  ) {
    return this.odontogramService.savePatientOdontogram(
      user.activeTenantId,
      patientId,
      user,
      dto,
    );
  }
}

