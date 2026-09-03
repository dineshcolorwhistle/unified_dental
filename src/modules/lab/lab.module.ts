import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuthModule } from '../../core/auth/auth.module';
import { MailModule } from '../../core/mail/mail.module';
import { BranchesModule } from '../../core/branches/branches.module';
import { LabUsersController } from './users/lab-users.controller';
import { LabTechniciansController } from './users/lab-technicians.controller';
import { LabUsersService } from './users/lab-users.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    BranchesModule,
  ],
  controllers: [
    LabUsersController,
    LabTechniciansController,
  ],
  providers: [
    LabUsersService,
  ],
  exports: [
    LabUsersService,
  ],
})
export class LabModule {}
