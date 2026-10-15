import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../shared/prisma/prisma.module';
import { AuthModule } from '../../../core/auth/auth.module';
import { MailModule } from '../../../core/mail/mail.module';
import { BulkUploadController } from './bulk-upload.controller';
import { BulkUploadService } from './bulk-upload.service';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  controllers: [BulkUploadController],
  providers: [BulkUploadService],
  exports: [BulkUploadService],
})
export class BulkUploadModule {}
