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
import { ClinicTypesModule } from './types/clinic-types.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ClinicPaymentMethodsController } from './payment-methods/clinic-payment-methods.controller';
import { ClinicPaymentMethodsService } from './payment-methods/clinic-payment-methods.service';
import { SpecializationsController } from './specializations/specializations.controller';
import { SpecializationsService } from './specializations/specializations.service';
import { ClinicServicesController } from './services/clinic-services.controller';
import { ClinicServicesService } from './services/clinic-services.service';
import { ClinicWhatsappTemplatesController } from './whatsapp-templates/clinic-whatsapp-templates.controller';
import { ClinicWhatsappTemplatesService } from './whatsapp-templates/clinic-whatsapp-templates.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    BranchesModule,
    ModulesModule,
    ClinicTypesModule,
    PatientsModule,
    AppointmentsModule,
  ],
  controllers: [
    ClinicAdminController,
    ClinicStaffController,
    ClinicDoctorsController,
    ClinicPaymentMethodsController,
    SpecializationsController,
    ClinicServicesController,
    ClinicWhatsappTemplatesController,
  ],
  providers: [
    ClinicUsersService,
    ClinicPaymentMethodsService,
    SpecializationsService,
    ClinicServicesService,
    ClinicWhatsappTemplatesService,
  ],
  exports: [
    ClinicUsersService,
    ClinicPaymentMethodsService,
    SpecializationsService,
    ClinicServicesService,
    ClinicWhatsappTemplatesService,
    ClinicTypesModule,
    PatientsModule,
    AppointmentsModule,
  ],
})
export class ClinicModule {}
