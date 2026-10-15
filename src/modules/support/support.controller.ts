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
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Support Portal')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get KPI metrics for support tickets' })
  getMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.supportService.getMetrics(user, tenantId);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets with pagination, filters, and search' })
  findAll(
    @Query() query: TicketQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.findAll(query, user);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get support ticket details and conversation thread' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.findOne(id, user);
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket (Lab Admin only)' })
  create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.createTicket(dto, user);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update support ticket title, description, or images (Lab Admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.updateTicket(id, dto, user);
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Update support ticket status (Platform Admin & Lab Admin)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.updateStatus(id, dto, user);
  }

  @Delete('tickets/:id')
  @ApiOperation({ summary: 'Delete a support ticket (Tenant Admin only)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.deleteTicket(id, user);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Add a reply message to the ticket conversation thread' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.addMessage(id, dto, user);
  }
}
