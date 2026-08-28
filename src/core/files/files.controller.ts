import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FilesService } from './files.service';
import { CurrentUser, AuthenticatedUser } from '../../shared/common/decorators/current-user.decorator';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment, scan, or impression file' })
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('resourceType') resourceType: string,
    @Body('resourceId') resourceId: string,
    @Body('moduleKey') moduleKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.saveFile({
      tenantId: user.activeTenantId,
      branchId: user.activeBranchId,
      moduleKey,
      resourceType: resourceType || 'ATTACHMENT',
      resourceId,
      file,
      uploadedBy: user.id,
    });
  }

  @Public()
  @Get(':id/download')
  @ApiOperation({ summary: 'Download or stream a file by ID' })
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Res() res: Response,
  ) {
    const { record, stream } = await this.filesService.getFile(
      id,
      user?.isSuperAdmin ? undefined : user?.activeTenantId,
    );

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.originalName)}"`,
    );
    stream.pipe(res);
  }

  @Get()
  @ApiOperation({ summary: 'List file records in current tenant' })
  listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.filesService.listFiles(user.activeTenantId, resourceType, resourceId);
  }
}
