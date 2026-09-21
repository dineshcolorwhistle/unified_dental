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
import { InventoryCategoriesService } from './inventory-categories.service';
import { CreateInventoryCategoryDto, UpdateInventoryCategoryDto } from './dto/inventory.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Inventory — Categories')
@ApiBearerAuth()
@Controller('inventory/categories')
export class InventoryCategoriesController {
  constructor(private readonly categoriesService: InventoryCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Inventory Categories (branch-scoped for operators, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('moduleKey') moduleKey?: string,
  ) {
    return this.categoriesService.findAll(user.activeTenantId, user, branchId, moduleKey || 'LAB');
  }

  @Post()
  @ApiOperation({ summary: 'Create an Inventory Category (Branch operator only; Tenant Admin restricted)' })
  create(
    @Body() dto: CreateInventoryCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an Inventory Category (Branch operator only; Tenant Admin restricted)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Inventory Category (Tenant Admin ONLY — validates no linked items)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.remove(id, user.activeTenantId, user);
  }
}
