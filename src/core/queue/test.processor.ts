import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('test-queue')
export class TestQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(TestQueueProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(
      `🚀 [BullMQ Worker] Job "${job.name}" (ID: ${job.id}) processed successfully! Data: ${JSON.stringify(job.data)}`,
    );
    return { success: true, timestamp: new Date().toISOString() };
  }
}
