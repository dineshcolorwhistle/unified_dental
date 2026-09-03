import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService, SendMailOptions } from './mail.service';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendMailOptions, any, string>): Promise<any> {
    this.logger.log(
      `📬 [BullMQ Mail Worker] Processing email job ID: ${job.id} | Template: ${job.data.template} | To: ${job.data.to}`,
    );
    try {
      return await this.mailService.sendDirectMail(job.data);
    } catch (error) {
      this.logger.error(
        `❌ [BullMQ Mail Worker] Failed to send email for job ID ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
