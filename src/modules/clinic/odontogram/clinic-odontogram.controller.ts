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
}

