import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlanService } from './subscription-plan.service';
import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-plan.dto';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Subscriptions')
@Controller('plans')
export class SubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all subscription plans' })
  findAll() {
    return this.planService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get subscription plan details by ID' })
  findOne(@Param('id') id: string) {
    return this.planService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription plan (Super Admin)' })
  create(
    @Body() dto: CreateSubscriptionPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.planService.create(dto, user?.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update subscription plan name, description, active status, and module selection (Super Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.planService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a subscription plan (Super Admin)' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.planService.delete(id, user?.id);
  }
}
