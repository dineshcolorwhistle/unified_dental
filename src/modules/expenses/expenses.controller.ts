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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, QueryExpensesDto, UpdateExpenseDto } from './dto/expenses.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Expenses — Management')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List all Expenses with filters and statistical summary' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.findAll(query, user.activeTenantId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Expense by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.findOne(id, user.activeTenantId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Expense (Lab Admin auto-assigned, Tenant Admin selectable)' })
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Expense (Lab Admin scoped to branch, Tenant Admin all)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Expense (Tenant Admin ONLY)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.remove(id, user.activeTenantId, user);
  }
}
