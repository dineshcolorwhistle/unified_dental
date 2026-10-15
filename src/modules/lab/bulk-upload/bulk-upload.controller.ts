import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { BulkUploadService } from './bulk-upload.service';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Dental Lab — Bulk Upload')
@ApiBearerAuth()
@Controller('lab/bulk-upload')
export class BulkUploadController {
  constructor(private readonly bulkUploadService: BulkUploadService) {}

  @Get('template')
  @ApiOperation({
    summary:
      'Download multi-sheet Excel template for Technicians, Doctors, Process Areas, and Processes (Lab Admin only)',
  })
  async downloadTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.bulkUploadService.generateTemplate(
      user.activeTenantId,
      user,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  }

  @Post('validate')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Dry-run validate an uploaded Excel template before importing (Lab Admin only)',
  })
  async validateTemplate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required.');
    }

    const branchId = await this.bulkUploadService.assertLabAdmin(
      user,
      user.activeTenantId,
    );

    const validation = await this.bulkUploadService.parseAndValidate(
      file.buffer,
      user.activeTenantId,
      branchId,
      user,
    );

    const totalRows = validation.data
      ? validation.data.technicians.length +
        validation.data.doctors.length +
        validation.data.processAreas.length +
        validation.data.processes.length
      : 0;

    return {
      valid: validation.valid,
      totalRows,
      counts: {
        technicians: validation.data?.technicians.length || 0,
        doctors: validation.data?.doctors.length || 0,
        processAreas: validation.data?.processAreas.length || 0,
        processes: validation.data?.processes.length || 0,
      },
      errors: validation.errors,
    };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload and import completed Excel template for Technicians, Doctors, Process Areas, and Processes (Lab Admin only)',
  })
  async importTemplate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required.');
    }

    const branchId = await this.bulkUploadService.assertLabAdmin(
      user,
      user.activeTenantId,
    );

    const validation = await this.bulkUploadService.parseAndValidate(
      file.buffer,
      user.activeTenantId,
      branchId,
      user,
    );

    if (!validation.valid || !validation.data) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Template validation failed. Please correct the highlighted errors.',
        errors: validation.errors,
      });
    }

    return this.bulkUploadService.executeImport(
      validation.data,
      user.activeTenantId,
      user,
    );
  }
}
