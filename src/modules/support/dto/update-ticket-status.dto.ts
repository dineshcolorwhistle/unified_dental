import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @ApiProperty({
    enum: SupportTicketStatus,
    description: 'Status of the ticket: CREATED, IN_PROGRESS, or COMPLETED',
    example: SupportTicketStatus.IN_PROGRESS,
  })
  @IsEnum(SupportTicketStatus)
  @IsNotEmpty()
  status: SupportTicketStatus;
}
