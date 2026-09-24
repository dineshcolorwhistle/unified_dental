import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';
import { MailModule } from '../../core/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}
