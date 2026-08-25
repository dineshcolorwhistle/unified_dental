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
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all branches in the active tenant organization (optionally filtered by moduleKey)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('moduleKey') moduleKey?: string,
  ) {
    return this.branchesService.findAllForTenant(user.activeTenantId, moduleKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch details by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.findById(id, user.activeTenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new branch in current tenant' })
  create(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.create(dto, user.activeTenantId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update branch details and status' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.update(id, dto, user.activeTenantId, user.id);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset all branches for the active tenant organization' })
  reset(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.resetBranches(user.activeTenantId, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a branch location' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchesService.remove(id, user.activeTenantId, user.id);
  }
}
