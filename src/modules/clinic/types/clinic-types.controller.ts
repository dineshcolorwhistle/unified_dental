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
import { ClinicTypesService } from './clinic-types.service';
import { CreateClinicTypeDto } from './dto/create-clinic-type.dto';
import { UpdateClinicTypeDto } from './dto/update-clinic-type.dto';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Clinic Types')
@Controller('clinic-types')
export class ClinicTypesController {
  constructor(private readonly clinicTypesService: ClinicTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List all clinic types' })
  findAll(@Query('all') all?: string) {
    const includeInactive = all !== 'false';
    return this.clinicTypesService.findAll(includeInactive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic type by ID' })
  findOne(@Param('id') id: string) {
    return this.clinicTypesService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new clinic type with configurable features' })
  create(
    @Body() dto: CreateClinicTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicTypesService.create(dto, user?.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update clinic type and feature selection' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicTypesService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete clinic type (prevented if assigned to tenants)' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicTypesService.delete(id, user?.id);
  }
}
