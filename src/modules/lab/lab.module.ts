import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { MailModule } from '../../core/mail/mail.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { ModulesModule } from '../../core/modules/modules.module';
import { LabUsersController } from './users/lab-users.controller';
import { LabTechniciansController } from './users/lab-technicians.controller';
import { ProcessAreasController } from './process-areas/process-areas.controller';
import { ProcessesController } from './processes/processes.controller';
import { ProsthesisTypesController } from './prosthesis-types/prosthesis-types.controller';
import { LabUsersService } from './users/lab-users.service';
import { ProcessAreasService } from './process-areas/process-areas.service';
import { ProcessesService } from './processes/processes.service';
import { ProsthesisTypesService } from './prosthesis-types/prosthesis-types.service';

import { DoctorsController } from './doctors/doctors.controller';
import { DoctorsService } from './doctors/doctors.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    BranchesModule,
    ModulesModule,
  ],
  controllers: [
    LabUsersController,
    LabTechniciansController,
    ProcessAreasController,
    ProcessesController,
    ProsthesisTypesController,
    DoctorsController,
  ],
  providers: [
    LabUsersService,
    ProcessAreasService,
    ProcessesService,
    ProsthesisTypesService,
    DoctorsService,
  ],
  exports: [
    LabUsersService,
    ProcessAreasService,
    ProcessesService,
    ProsthesisTypesService,
    DoctorsService,
  ],
})
export class LabModule {}
