import { ApiProperty } from '@nestjs/swagger';

export interface BulkUploadRowError {
  sheet: 'Technician' | 'Doctor' | 'Process Area' | 'Process';
  row: number;
  column: string;
  value?: string;
  message: string;
}

export class BulkUploadValidationResponseDto {
  @ApiProperty({ description: 'Whether the entire workbook passed validation', example: true })
  valid: boolean;

  @ApiProperty({ description: 'Total rows processed across all sheets', example: 25 })
  totalRows: number;

  @ApiProperty({
    description: 'Breakdown of records to be created by sheet',
    example: { technicians: 5, doctors: 10, processAreas: 3, processes: 7 },
  })
  counts: {
    technicians: number;
    doctors: number;
    processAreas: number;
    processes: number;
  };

  @ApiProperty({
    description: 'Detailed list of validation errors if valid is false',
    type: 'array',
  })
  errors: BulkUploadRowError[];
}

export class BulkUploadImportResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Bulk data imported successfully.' })
  message: string;

  @ApiProperty({
    example: { technicians: 5, doctors: 10, processAreas: 3, processes: 7 },
  })
  imported: {
    technicians: number;
    doctors: number;
    processAreas: number;
    processes: number;
  };

  @ApiProperty({ example: 'uuid-branch-id' })
  branchId: string;

  @ApiProperty({ example: 'Main Lab Branch' })
  branchName: string;
}
