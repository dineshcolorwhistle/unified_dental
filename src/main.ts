import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './shared/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './shared/common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Tenant-Slug,X-Branch-Id,X-Custom-Lang,Accept-Language',
  });

  // Global Prefix for API endpoints
  app.setGlobalPrefix('api');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Interceptors & Exception Filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Unified Dental Healthcare Platform API')
    .setDescription(
      'Multi-tenant SaaS API for Dental Clinic and Dental Laboratory operations with native auth, multi-branching, RBAC, and real-time streaming.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Tenancy')
    .addTag('Branches')
    .addTag('Users')
    .addTag('RBAC & Permissions')
    .addTag('Modules')
    .addTag('Audit Logs')
    .addTag('Files')
    .addTag('Notifications')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Unified Dental Platform Backend running on http://localhost:${port}`);
  logger.log(`📚 Swagger API Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
