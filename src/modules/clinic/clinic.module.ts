import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { MailModule } from '../../core/mail/mail.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { ModulesModule } from '../../core/modules/modules.module';
import { ClinicUsersService } from './users/clinic-users.service';
import { ClinicAdminController } from './users/clinic-admin.controller';
import { ClinicStaffController } from './users/clinic-staff.controller';
import { ClinicDoctorsController } from './users/clinic-doctors.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    BranchesModule,
    ModulesModule,
  ],
  controllers: [
    ClinicAdminController,
    ClinicStaffController,
    ClinicDoctorsController,
  ],
  providers: [
    ClinicUsersService,
  ],
  exports: [
    ClinicUsersService,
  ],
})
export class ClinicModule {}
