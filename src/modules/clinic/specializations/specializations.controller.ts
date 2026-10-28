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
import { SpecializationsService } from './specializations.service';
import {
  CreateSpecializationDto,
  UpdateSpecializationDto,
  QuerySpecializationsDto,
} from './dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Clinic — Specializations')
@ApiBearerAuth()
@Controller('clinic/specializations')
export class SpecializationsController {
  constructor(private readonly specializationsService: SpecializationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clinic specializations (tenant-scoped)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QuerySpecializationsDto,
  ) {
    return this.specializationsService.findAll(user.activeTenantId, user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single specialization by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.specializationsService.findOne(user.activeTenantId, id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new specialization' })
  create(
    @Body() dto: CreateSpecializationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.specializationsService.create(dto, user.activeTenantId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specialization' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSpecializationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.specializationsService.update(id, dto, user.activeTenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specialization' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.specializationsService.remove(id, user.activeTenantId, user);
  }
}
