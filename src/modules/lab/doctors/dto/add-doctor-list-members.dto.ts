import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddDoctorListMembersDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description: 'Array of doctor IDs to add to this group',
    type: [String],
  })
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  doctorIds: string[];
}
