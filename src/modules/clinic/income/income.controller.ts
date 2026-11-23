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
import { IncomeService } from './income.service';
import {
  QueryIncomeRecordsDto,
  AddServiceLineDto,
  UpdateServiceLineDto,
  AddProductLineDto,
  UpdateProductLineDto,
  AddIncomePaymentDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Income')
@ApiBearerAuth()
@Controller('clinic/income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  @ApiOperation({ summary: 'List all income records with filters and pagination' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryIncomeRecordsDto,
  ) {
    return this.incomeService.findAll(user.activeTenantId, query, user);
  }

  @Get('by-appointment/:appointmentId')
  @ApiOperation({ summary: 'Get or auto-create income record for an appointment' })
  getByAppointment(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.getOrCreateByAppointment(appointmentId, user.activeTenantId, user);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'Get full income record details with lines and payments' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.findOne(id, user.activeTenantId);
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Add a service line to income record' })
  addServiceLine(
    @Param('id') id: string,
    @Body() dto: AddServiceLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.addServiceLine(id, dto, user.activeTenantId, user);
  }

  @Patch(':id/services/:lineId')
  @ApiOperation({ summary: 'Update a service line (quantity, discount)' })
  updateServiceLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateServiceLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.updateServiceLine(id, lineId, dto, user.activeTenantId, user);
  }

  @Patch(':id/services/:lineId/complete')
  @ApiOperation({ summary: 'Toggle completion of a service line' })
  toggleServiceComplete(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.toggleServiceComplete(id, lineId, user.activeTenantId, user);
  }

  @Delete(':id/services/:lineId')
  @ApiOperation({ summary: 'Delete a service line' })
  removeServiceLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.removeServiceLine(id, lineId, user.activeTenantId, user);
  }

  @Post(':id/products')
  @ApiOperation({ summary: 'Add an inventory product to income record (deducts stock)' })
  addProductLine(
    @Param('id') id: string,
    @Body() dto: AddProductLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.addProductLine(id, dto, user.activeTenantId, user);
  }

  @Patch(':id/products/:lineId')
  @ApiOperation({ summary: 'Update an inventory product quantity (adjusts stock)' })
  updateProductLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateProductLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.updateProductLine(id, lineId, dto, user.activeTenantId, user);
  }

  @Delete(':id/products/:lineId')
  @ApiOperation({ summary: 'Delete a product line (restores inventory stock)' })
  removeProductLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.removeProductLine(id, lineId, user.activeTenantId, user);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment for an income record' })
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddIncomePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.addPayment(id, dto, user.activeTenantId, user);
  }

  @Get(':id/variance')
  @ApiOperation({ summary: 'Get variance analysis between expected and actual completed amounts' })
  getVariance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.getVariance(id, user.activeTenantId);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Get audit logs for income record' })
  getAudit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.incomeService.getAudit(id, user.activeTenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/finalize')
  @ApiOperation({ summary: 'Finalize income record' })
  finalize(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incomeService.finalize(id, user.activeTenantId, user);
  }
}
