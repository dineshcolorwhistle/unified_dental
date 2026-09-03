import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ReorderProcessesDto {
  @ApiProperty({
    description: 'Complete ordered list of Process IDs in their new sequence order',
    type: [String],
    example: ['uuid-process-2', 'uuid-process-1'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  processIds: string[];
}
