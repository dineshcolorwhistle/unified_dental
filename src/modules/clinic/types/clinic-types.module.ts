import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../shared/prisma/prisma.module';
import { ClinicTypesService } from './clinic-types.service';
import { ClinicTypesController } from './clinic-types.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ClinicTypesController],
  providers: [ClinicTypesService],
  exports: [ClinicTypesService],
})
export class ClinicTypesModule {}
