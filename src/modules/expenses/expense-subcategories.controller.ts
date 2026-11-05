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
import { ExpenseSubcategoriesService } from './expense-subcategories.service';
import { CreateExpenseSubcategoryDto, UpdateExpenseSubcategoryDto } from './dto/expenses.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Expenses — Subcategories')
@ApiBearerAuth()
@Controller('expenses/subcategories')
export class ExpenseSubcategoriesController {
  constructor(private readonly subcategoriesService: ExpenseSubcategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get Expense Subcategories with expense counts and amount tracking' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoryId') categoryId?: string,
    @Query('branchId') branchId?: string,
    @Query('moduleKey') moduleKey?: string,
  ) {
    return this.subcategoriesService.findAll(
      user.activeTenantId,
      user,
      categoryId,
      branchId,
      moduleKey || 'LAB',
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create an Expense Subcategory' })
  create(
    @Body() dto: CreateExpenseSubcategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subcategoriesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an Expense Subcategory' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseSubcategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subcategoriesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Expense Subcategory (Tenant Admin ONLY)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subcategoriesService.remove(id, user.activeTenantId, user);
  }
}

