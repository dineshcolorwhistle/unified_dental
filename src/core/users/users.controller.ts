import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AssignUserModulesDto,
  AssignUserRolesDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/users.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users in active tenant organization' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    const tenantId = user.activeTenantId;
    return this.usersService.findAllForTenant(tenantId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findById(id, user.activeTenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create/Invite a new user into tenant organization' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.create(dto, user.activeTenantId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, user.activeTenantId, user.id);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Assign roles to a user in tenant' })
  assignRoles(
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.assignRoles(dto, user.id);
  }

  @Post('modules')
  @ApiOperation({ summary: 'Assign personal module access to a user' })
  assignModules(
    @Body() dto: AssignUserModulesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.assignModules(dto, user.id);
  }
}
