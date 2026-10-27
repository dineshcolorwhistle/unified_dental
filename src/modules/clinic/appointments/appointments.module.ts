import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../shared/prisma/prisma.module';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { WorkingHoursController } from './working-hours.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentsController, WorkingHoursController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
