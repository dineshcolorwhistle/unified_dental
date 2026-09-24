import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import {
  QueryFinanceOverviewDto,
  QueryDoctorBalancesDto,
  QueryDoctorListsDto,
  QueryDoctorOrdersDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Finance — Reports & Analytics')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get finance overview with KPIs, charts, and branch performance' })
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryFinanceOverviewDto,
  ) {
    return this.financeService.getOverview(query, user.activeTenantId, user);
  }

  @Get('doctor-balances')
  @ApiOperation({ summary: 'Get doctor financial balances with pagination and subtotal' })
  getDoctorBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDoctorBalancesDto,
  ) {
    return this.financeService.getDoctorBalances(query, user.activeTenantId, user);
  }

  @Get('doctor-balances/:doctorId/orders')
  @ApiOperation({ summary: 'Get work orders for a specific doctor with financial details' })
  getDoctorOrders(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDoctorOrdersDto,
  ) {
    return this.financeService.getDoctorOrders(doctorId, query, user.activeTenantId, user);
  }

  @Post('orders/:orderId/mark-as-paid')
  @ApiOperation({ summary: 'Mark a work order as fully paid (settles remaining balance)' })
  markOrderAsPaid(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.markOrderAsPaid(orderId, user.activeTenantId, user);
  }

  @Get('doctor-lists')
  @ApiOperation({ summary: 'Get doctor lists with aggregated financial summaries' })
  getDoctorLists(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDoctorListsDto,
  ) {
    return this.financeService.getDoctorLists(query, user.activeTenantId, user);
  }

  @Get('doctor-lists/:listId/breakdown')
  @ApiOperation({ summary: 'Get member-by-member financial breakdown for a doctor list' })
  getDoctorListBreakdown(
    @Param('listId') listId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('moduleKey') moduleKey?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getDoctorListBreakdown(
      listId,
      user.activeTenantId,
      user,
      moduleKey,
      branchId,
      startDate,
      endDate,
    );
  }
}
