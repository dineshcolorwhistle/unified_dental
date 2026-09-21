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
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/expenses.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Expenses — Categories')
@ApiBearerAuth()
@Controller('expenses/categories')
export class ExpenseCategoriesController {
  constructor(private readonly categoriesService: ExpenseCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Expense Categories (branch-scoped for Lab Admin, all/filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('moduleKey') moduleKey?: string,
  ) {
    return this.categoriesService.findAll(user.activeTenantId, user, branchId, moduleKey || 'LAB');
  }

  @Post()
  @ApiOperation({ summary: 'Create an Expense Category (Lab Admin auto-assigned, Tenant Admin selectable)' })
  create(
    @Body() dto: CreateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an Expense Category (Lab Admin scoped to branch, Tenant Admin all)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Expense Category (Tenant Admin ONLY — validates no linked expenses)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.remove(id, user.activeTenantId, user);
  }
}
