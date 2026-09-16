import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendWorkOrderChatMessageDto {
  @ApiProperty({ description: 'Chat message content', example: 'Please review the margins for tooth #14' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
