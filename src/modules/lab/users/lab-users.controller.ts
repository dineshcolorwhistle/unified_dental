import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LabUsersService } from './lab-users.service';
import { CreateLabAdminDto } from './dto/create-lab-admin.dto';
import { UpdateLabAdminDto } from './dto/update-lab-admin.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Lab — Users & Admins')
@ApiBearerAuth()
@Controller('lab/users/admin')
export class LabUsersController {
  constructor(private readonly labUsersService: LabUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Lab Administrators in current organization' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.labUsersService.findAllLabAdmins(user.activeTenantId, branchId, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Lab Administrator (Tenant Admin only)' })
  create(
    @Body() dto: CreateLabAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.createLabAdmin(dto, user.activeTenantId, user);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend password reset welcome email to Lab Administrator' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.resendInvite(id, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Lab Administrator profile and branch assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLabAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.updateLabAdmin(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove Lab Administrator from organization' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labUsersService.deleteLabAdmin(id, user.activeTenantId, user);
  }
}
