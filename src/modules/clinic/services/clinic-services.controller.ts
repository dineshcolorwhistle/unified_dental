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
import { ClinicServicesService } from './clinic-services.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  QueryServicesDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Services')
@ApiBearerAuth()
@Controller('clinic/services')
export class ClinicServicesController {
  constructor(private readonly clinicServicesService: ClinicServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all clinic services (branch-scoped for Clinic Admin, filtered for Tenant Admin)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryServicesDto,
  ) {
    return this.clinicServicesService.findAll(user.activeTenantId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single clinic service by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicServicesService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new clinic service' })
  create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicServicesService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a clinic service' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicServicesService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a clinic service' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicServicesService.remove(id, user.activeTenantId, user);
  }
}
