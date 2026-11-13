import { PartialType } from '@nestjs/swagger';
import { CreateReminderDto } from './create-reminder.dto';

/**
 * DTO for editing reminder details.
 * Note: Status is automatically calculated based on schedule and lifecycle.
 * Manual status updates are disallowed. Cancellation is performed via the dedicated /cancel endpoint.
 */
export class UpdateReminderDto extends PartialType(CreateReminderDto) {}
