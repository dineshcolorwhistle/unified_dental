import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendWorkOrderChatMessageDto {
  @ApiProperty({ description: 'Chat message content', example: 'Please review the margins for tooth #14', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  message?: string;

  @ApiProperty({ description: 'Attachment metadata array', required: false })
  @IsOptional()
  attachments?: any;
}
