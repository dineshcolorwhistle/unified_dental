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
import { ClinicPaymentMethodsService } from './clinic-payment-methods.service';
import {
  CreateClinicPaymentMethodDto,
  UpdateClinicPaymentMethodDto,
  QueryClinicPaymentMethodsDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Payment Methods')
@ApiBearerAuth()
@Controller('clinic/payment-methods')
export class ClinicPaymentMethodsController {
  constructor(private readonly paymentMethodsService: ClinicPaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clinic payment methods (branch-scoped for Clinic Admin, filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryClinicPaymentMethodsDto,
  ) {
    return this.paymentMethodsService.findAll(user.activeTenantId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single clinic payment method by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodsService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new clinic payment method' })
  create(
    @Body() dto: CreateClinicPaymentMethodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodsService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a clinic payment method' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicPaymentMethodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodsService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or deactivate a clinic payment method' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentMethodsService.remove(id, user.activeTenantId, user);
  }
}
