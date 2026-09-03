import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: Number(configService.get<string>('REDIS_DB', '0')),
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) => {
            const isProd = configService.get<string>('NODE_ENV') === 'production';
            if (!isProd) {
              // In local development without Redis, back off significantly
              return Math.min(times * 5000, 60000);
            }
            return Math.min(times * 1000, 10000);
          },
        },
        prefix: configService.get<string>('REDIS_PREFIX', 'unified'),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}