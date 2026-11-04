import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DoctorServiceAssignmentDto {
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customPrice: number;
}

