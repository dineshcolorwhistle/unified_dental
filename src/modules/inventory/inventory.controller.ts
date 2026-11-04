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
import { InventoryService } from './inventory.service';
import {
  AddStockDto,
  AdjustStockDto,
  CreateInventoryItemDto,
  QueryInventoryActivitiesDto,
  QueryInventoryItemsDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Inventory — Management')
@ApiBearerAuth()
@Controller('inventory/items')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all Inventory Items with filters, pagination, and statistical summary' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInventoryItemsDto,
  ) {
    return this.inventoryService.findAll(query, user.activeTenantId, user);
  }

  @Get('sku/generate')
  @ApiOperation({ summary: 'Generate a unique suggested SKU code' })
  generateSku(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.generateSku(user.activeTenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Inventory Item by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.findOne(id, user.activeTenantId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Inventory Item (Branch operator only; Tenant Admin restricted)' })
  create(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Inventory Item (Branch operator only; Tenant Admin restricted)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.update(id, dto, user.activeTenantId, user);
  }

  @Post(':id/add-stock')
  @ApiOperation({ summary: 'Add stock quantity to an Inventory Item' })
  addStock(
    @Param('id') id: string,
    @Body() dto: AddStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.addStock(id, dto, user.activeTenantId, user);
  }

  @Post(':id/adjust-stock')
  @ApiOperation({ summary: 'Manually adjust stock quantity of an Inventory Item' })
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustStock(id, dto, user.activeTenantId, user);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Get audit activity log for an Inventory Item' })
  getActivities(
    @Param('id') id: string,
    @Query() query: QueryInventoryActivitiesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getItemActivities(id, query, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Inventory Item (Tenant Admin all branches, Branch operator assigned branch)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.remove(id, user.activeTenantId, user);
  }
}
