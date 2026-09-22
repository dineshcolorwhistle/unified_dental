import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QrTrackingService } from './qr-tracking.service';
import { CreateQrInquiryDto } from './dto/create-qr-inquiry.dto';
import { QueryQrInquiriesDto } from './dto/query-qr-inquiries.dto';
import { Public } from '../../../shared/common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';

@ApiTags('Work Order QR & Tracking')
@Controller()
export class QrTrackingController {
  constructor(private readonly qrTrackingService: QrTrackingService) {}

  /**
   * 1. Public Work Order Tracking Details by QR Token
   * Open to anyone scanning the QR code; strictly omits financial/payment records.
   */
  @Public()
  @Get('public/qr/:qrToken')
  @ApiOperation({ summary: 'Get public work order tracking details by QR token (No payment details)' })
  findByQrToken(@Param('qrToken') qrToken: string) {
    return this.qrTrackingService.findByQrToken(qrToken);
  }

  /**
   * 2. Public Lead Submission: "I'm Interested" Form
   */
  @Public()
  @Post('public/qr/inquiry')
  @ApiOperation({ summary: 'Submit an interested inquiry from the public QR tracking page' })
  createInquiry(@Body() dto: CreateQrInquiryDto) {
    return this.qrTrackingService.createInquiry(dto);
  }

  /**
   * 3. Platform Super Admin: Query all QR inquiries across tenants
   */
  @Get('platform/qr-inquiries')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all QR tracking leads/inquiries (Platform Super Admin)' })
  findAllInquiries(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryQrInquiriesDto,
  ) {
    return this.qrTrackingService.findAllInquiries(actor, query);
  }

  /**
   * 4. Platform Super Admin: Update inquiry status
   */
  @Patch('platform/qr-inquiries/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update inquiry status (Platform Super Admin)' })
  updateInquiryStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('notes') notes: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.qrTrackingService.updateInquiryStatus(id, status, notes, actor);
  }

  /**
   * 5. Platform Super Admin: Delete inquiry
   */
  @Delete('platform/qr-inquiries/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete inquiry (Platform Super Admin)' })
  deleteInquiry(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.qrTrackingService.deleteInquiry(id, actor);
  }
}
