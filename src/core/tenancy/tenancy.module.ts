import { forwardRef, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { TenancyController } from './tenancy.controller';
import { TenancyMiddleware } from './tenancy.middleware';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [TenancyController],
  providers: [TenancyService, TenancyMiddleware],
  exports: [TenancyService, TenancyMiddleware],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
