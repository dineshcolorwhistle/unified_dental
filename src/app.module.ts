import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';

// Shared & Core Modules
import { PrismaModule } from './shared/prisma/prisma.module';
import { TenancyModule } from './core/tenancy/tenancy.module';
import { ModulesModule } from './core/modules/modules.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { BranchesModule } from './core/branches/branches.module';
import { RbacModule } from './core/rbac/rbac.module';
import { AuditModule } from './core/audit/audit.module';
import { FilesModule } from './core/files/files.module';
import { MailModule } from './core/mail/mail.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { QueueModule } from './core/queue/queue.module';
import { SubscriptionsModule } from './core/subscriptions/subscriptions.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),

    // Internationalization (Backend i18n)
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
        watch: true,
      },
      resolvers: [
        new HeaderResolver(['x-custom-lang', 'accept-language']),
        new QueryResolver(['lang', 'l']),
      ],
    }),

    // Frontend SPA static hosting
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'client', 'dist'),
      exclude: ['/api/(.*)'],
      serveStaticOptions: {
        fallthrough: true,
      },
    }),

    // Shared & Core Platform Modules
    PrismaModule,
    TenancyModule,
    SubscriptionsModule,
    ModulesModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    RbacModule,
    AuditModule,
    FilesModule,
    QueueModule,
    MailModule,
    NotificationsModule,
  ],
})
export class AppModule {}
