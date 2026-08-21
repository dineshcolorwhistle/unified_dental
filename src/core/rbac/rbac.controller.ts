import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/rbac.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('RBAC & Permissions')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Get list of all system permissions grouped by domain' })
  getPermissions() {
    return this.rbacService.getAllPermissions();
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get system roles and custom tenant roles' })
  getRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.rbacService.getRolesForTenant(user.activeTenantId);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create custom tenant role' })
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rbacService.createRole(dto, user.activeTenantId, user.id);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update custom tenant role' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rbacService.updateRole(id, dto, user.activeTenantId, user.id);
  }
}
