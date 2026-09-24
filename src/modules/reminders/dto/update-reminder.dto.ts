import { PartialType } from '@nestjs/swagger';
import { CreateReminderDto } from './create-reminder.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateReminderDto extends PartialType(CreateReminderDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
