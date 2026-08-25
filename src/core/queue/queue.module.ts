import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { TestQueueProcessor } from './test.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: Number(configService.get<string>('REDIS_DB', '0')),
          maxRetriesPerRequest: null,
        },
        prefix: configService.get<string>('REDIS_PREFIX', 'unified'),
      }),
    }),
    BullModule.registerQueue({
      name: 'test-queue',
    }),
  ],
  providers: [TestQueueProcessor],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  constructor(@InjectQueue('test-queue') private readonly testQueue: Queue) {}

  async onModuleInit() {
    try {
      this.logger.log('🧪 Dispatching test job to BullMQ queue [test-queue]...');
      const job = await this.testQueue.add(
        'ping-test',
        {
          message: 'BullMQ + Redis integration is fully active!',
          sentAt: new Date().toISOString(),
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`📥 Test job enqueued with Job ID: ${job.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to enqueue test job: ${error.message}`);
    }
  }
}