import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderPriority, ReminderRecurrence, ReminderEndType } from '@prisma/client';

export class RecurrenceConfigDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  repeatEvery?: number;

  @ApiPropertyOptional({ example: [1, 3, 5], description: '0=Sun, 1=Mon, ..., 6=Sat' })
  @IsOptional()
  @IsArray()
  repeatOnDays?: number[];

  @ApiPropertyOptional({ enum: ['ON_DAY', 'ON_THE'] })
  @IsOptional()
  @IsString()
  monthlyType?: 'ON_DAY' | 'ON_THE';

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  monthlyDay?: number;

  @ApiPropertyOptional({ enum: ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST'] })
  @IsOptional()
  @IsString()
  monthlyRank?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';

  @ApiPropertyOptional({ example: 'MONDAY' })
  @IsOptional()
  @IsString()
  monthlyWeekday?: string;
}

export class CreateReminderDto {
  @ApiProperty({ example: 'Weekly Lab Equipment Cleaning' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ enum: ReminderPriority, default: ReminderPriority.MEDIUM })
  @IsOptional()
  @IsEnum(ReminderPriority)
  priority?: ReminderPriority = ReminderPriority.MEDIUM;

  @ApiPropertyOptional({ example: 'Cleaning' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Deep clean furnace and zirconia milling chamber' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ReminderRecurrence, default: ReminderRecurrence.ONE_TIME })
  @IsEnum(ReminderRecurrence)
  recurrence: ReminderRecurrence;

  @ApiProperty({ example: '2026-09-24', description: 'Calendar start date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsString()
  startDate: string;

  @ApiProperty({ example: '09:00', description: 'Reminder time in 24h format (HH:mm)' })
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'reminderTime must be a valid time in HH:mm format',
  })
  reminderTime: string;

  @ApiPropertyOptional({ type: RecurrenceConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceConfigDto)
  recurrenceConfig?: RecurrenceConfigDto;

  @ApiPropertyOptional({ enum: ReminderEndType })
  @IsOptional()
  @IsEnum(ReminderEndType)
  endType?: ReminderEndType;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  endOccurrences?: number;

  @ApiProperty({
    example: ['u:user-uuid-1', 'd:doctor-uuid-2'],
    description: 'Array of assignee identifiers with prefix u: (system user) or d: (doctor)',
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  assigneeIds: string[];

  @ApiPropertyOptional({ example: 'branch-uuid' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: 'LAB' })
  @IsOptional()
  @IsString()
  moduleKey?: string = 'LAB';
}
