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
          password: configService.get<string>('REDIS_PASSWORD'),
          db: Number(configService.get<string>('REDIS_DB', '0')),
          maxRetriesPerRequest: null,
        },
        prefix: configService.get<string>('REDIS_PREFIX', 'unified'),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule { }