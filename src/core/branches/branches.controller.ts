import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  @ApiOperation({ summary: 'Get all branches in the active tenant organization' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.findAllForTenant(user.activeTenantId);
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
}
