import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQrInquiryDto {
  @ApiProperty({ description: 'Unique QR token of the work order' })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiProperty({ description: 'Full name of the interested person' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Email address of the contact' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email: string;

  @ApiPropertyOptional({ description: 'Contact phone number (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Optional message or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  message?: string;
}
