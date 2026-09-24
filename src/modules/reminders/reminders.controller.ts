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
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { QueryRemindersDto } from './dto/query-reminders.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';

@ApiTags('Reminders — Management & Follow-ups')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('assignees')
  @ApiOperation({ summary: 'Get all eligible candidate assignees (Admins, Technicians, Doctors)' })
  getCandidateAssignees(@CurrentUser() user: AuthenticatedUser) {
    return this.remindersService.getCandidateAssignees(user.activeTenantId, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all Reminders with filters, search, and pagination' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryRemindersDto,
  ) {
    return this.remindersService.findAll(query, user.activeTenantId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single Reminder details by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.findOne(id, user.activeTenantId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Reminder (Lab Admin ONLY)' })
  create(
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Reminder (Lab Admin ONLY)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Reminder (Tenant Admin ONLY)' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.remove(id, user.activeTenantId, user);
  }
}
