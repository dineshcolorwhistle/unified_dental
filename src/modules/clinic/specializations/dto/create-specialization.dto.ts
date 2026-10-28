import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSpecializationDto {
  @ApiProperty({ example: 'Orthodontics', description: 'Name of the specialization' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Dental specialty focusing on teeth alignment', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
