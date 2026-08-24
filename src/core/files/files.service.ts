import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadFileParams {
  tenantId: string;
  branchId?: string;
  moduleKey?: string;
  resourceType: string;
  resourceId?: string;
  file: Express.Multer.File;
  uploadedBy?: string;
}

@Injectable()
export class FilesService {
  private readonly uploadBaseDir = process.env.UPLOAD_DIR || './uploads';

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadBaseDir)) {
      fs.mkdirSync(this.uploadBaseDir, { recursive: true });
    }
  }

  async saveFile(params: UploadFileParams) {
    const { tenantId, branchId, moduleKey, resourceType, resourceId, file, uploadedBy } = params;

    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    const effectiveMaxFileSizeMb =
      tenant?.maxUploadFileSizeMb !== null && tenant?.maxUploadFileSizeMb !== undefined
        ? Number(tenant.maxUploadFileSizeMb)
        : tenant?.plan?.maxUploadFileSizeMb !== null && tenant?.plan?.maxUploadFileSizeMb !== undefined
        ? Number(tenant.plan.maxUploadFileSizeMb)
        : 25;

    const maxBytes = effectiveMaxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      const actualSizeMb = (file.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size (${actualSizeMb} MB) exceeds the maximum allowed upload limit of ${effectiveMaxFileSizeMb} MB.`,
      );
    }

    const tenantDir = path.join(this.uploadBaseDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const uniqueFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const destinationPath = path.join(tenantDir, uniqueFilename);

    fs.writeFileSync(destinationPath, file.buffer);

    return this.prisma.fileRecord.create({
      data: {
        tenantId,
        branchId: branchId || null,
        moduleKey: moduleKey || null,
        resourceType,
        resourceId: resourceId || null,
        storagePath: destinationPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: uploadedBy || null,
      },
    });
  }

  async getFile(id: string, requestingTenantId?: string) {
    const record = await this.prisma.fileRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('File not found');
    }

    if (requestingTenantId && record.tenantId !== requestingTenantId) {
      throw new ForbiddenException('Access to file denied for this tenant');
    }

    if (!fs.existsSync(record.storagePath)) {
      throw new NotFoundException('File asset not found on disk storage');
    }

    return {
      record,
      stream: fs.createReadStream(record.storagePath),
    };
  }

  async listFiles(tenantId: string, resourceType?: string, resourceId?: string) {
    return this.prisma.fileRecord.findMany({
      where: {
        tenantId,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
