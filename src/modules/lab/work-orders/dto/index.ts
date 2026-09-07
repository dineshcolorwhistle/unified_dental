import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProcessStatus, ProcessType } from '@prisma/client';

export class WorkOrderProcessItemDto {
  @ApiProperty({ example: 'Vaciado de modelos', description: 'Name of the process step' })
  @IsString()
  @IsNotEmpty()
  processName: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  processId?: string;

  @ApiProperty({ enum: ProcessType, default: ProcessType.PRODUCTION, required: false })
  @IsEnum(ProcessType)
  @IsOptional()
  processType?: ProcessType;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  technicianId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ example: 0, description: 'Order sequence of the step' })
  @IsNumber()
  @Min(0)
  sequence: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isVerification?: boolean;

  @ApiProperty({ enum: ProcessStatus, default: ProcessStatus.NOT_STARTED, required: false })
  @IsEnum(ProcessStatus)
  @IsOptional()
  status?: ProcessStatus;
}

export class CreateWorkOrderDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Doctor ID' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  patient?: string;

  @ApiProperty({ example: 'FILE-101', required: false })
  @IsString()
  @IsOptional()
  fileNumber?: string;

  @ApiProperty({ example: 'BOX-42', required: false })
  @IsString()
  @IsOptional()
  boxNumber?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Prosthesis Type ID' })
  @IsUUID()
  @IsNotEmpty()
  prosthesisTypeId: string;

  @ApiProperty({ example: 'Color A2, 3 units zirconia crown', description: 'Clinical specifications' })
  @IsString()
  @IsNotEmpty()
  specification: string;

  @ApiProperty({ example: 'A1', description: 'Shade / color' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ example: 'Urgent delivery needed by morning', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: '2026-09-15', required: false })
  @IsString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ example: 2500, required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalQuote?: number;

  @ApiProperty({ example: 500, required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  initialPayment?: number;

  @ApiProperty({ example: ['REF-98765'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paymentReferenceNumbers?: string[];

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ enum: ['create', 'createAndAssign'], example: 'create' })
  @IsString()
  @IsNotEmpty()
  action: 'create' | 'createAndAssign';

  @ApiProperty({ type: [WorkOrderProcessItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderProcessItemDto)
  processes: WorkOrderProcessItemDto[];
}

export class AddWorkOrderNoteDto {
  @ApiProperty({ example: 'Wax setup checked and passed.', description: 'Note content' })
  @IsString()
  @IsNotEmpty()
  note: string;
}

export class QueryWorkOrdersDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  page?: string | number;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  limit?: string | number;
}

export class UpdateWorkOrderDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  patient?: string;

  @ApiProperty({ example: 'FILE-101', required: false })
  @IsString()
  @IsOptional()
  fileNumber?: string;

  @ApiProperty({ example: 'BOX-42', required: false })
  @IsString()
  @IsOptional()
  boxNumber?: string;

  @ApiProperty({ example: 'Color A2, 3 units zirconia crown', required: false })
  @IsString()
  @IsOptional()
  specification?: string;

  @ApiProperty({ example: 'A1', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ example: '2026-09-15', required: false })
  @IsString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ example: 2500, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalQuote?: number;

  @ApiProperty({ example: 500, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  initialPayment?: number;

  @ApiProperty({ example: ['REF-98765'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paymentReferenceNumbers?: string[];

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  prosthesisTypeId?: string;
}
