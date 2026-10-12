import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { QrTrackingController } from './qr-tracking.controller';
import { QrTrackingService } from './qr-tracking.service';
import { FilesModule } from '../../../core/files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [WorkOrdersController, QrTrackingController],
  providers: [WorkOrdersService, QrTrackingService],
  exports: [WorkOrdersService, QrTrackingService],
})
export class WorkOrdersModule {}

