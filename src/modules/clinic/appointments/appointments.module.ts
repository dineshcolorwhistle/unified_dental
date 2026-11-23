import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../shared/prisma/prisma.module';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { WorkingHoursController } from './working-hours.controller';
import { IncomeModule } from '../income/income.module';

@Module({
  imports: [PrismaModule, IncomeModule],
  controllers: [AppointmentsController, WorkingHoursController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
