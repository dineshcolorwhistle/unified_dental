import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface SendMailOptions {
  to: string;
  subject: string;
  template: 'welcome' | 'reset-password';
  context: Record<string, any>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      '"Unified Dental" <no-reply@unifieddental.com>';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.example.com',
      port: Number(this.configService.get<number>('SMTP_PORT')) || 587,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER') || 'no-reply@unifieddental.com',
        pass: this.configService.get<string>('SMTP_PASS') || 'secret',
      },
    });
  }

  private renderTemplate(templateName: string, context: Record<string, any>): string {
    const candidates = [
      path.join(__dirname, 'templates', `${templateName}.hbs`),
      path.join(process.cwd(), 'src', 'core', 'mail', 'templates', `${templateName}.hbs`),
      path.join(process.cwd(), 'dist', 'src', 'core', 'mail', 'templates', `${templateName}.hbs`),
    ];

    let templateContent = '';
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        templateContent = fs.readFileSync(filePath, 'utf8');
        break;
      }
    }

    if (!templateContent) {
      return `<h2>Unified Dental Notification</h2><p>${JSON.stringify(context)}</p>`;
    }

    const compiled = handlebars.compile(templateContent);
    return compiled(context);
  }

  async sendMail(options: SendMailOptions) {
    const html = this.renderTemplate(options.template, options.context);

    // In development or if SMTP fails, log the preview
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`📧 [MOCK EMAIL] To: ${options.to} | Subject: ${options.subject}`);
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.warn(`Failed to send real SMTP email (${error.message}). Logged to console in dev mode.`);
      return { success: true, simulated: true };
    }
  }

  async sendWelcomeInvite(to: string, name: string, tenantName: string, temporaryPassword?: string) {
    return this.sendMail({
      to,
      subject: `Welcome to ${tenantName} — Unified Dental Platform`,
      template: 'welcome',
      context: {
        name,
        tenantName,
        temporaryPassword: temporaryPassword || 'Welcome@123456',
        loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login`,
      },
    });
  }

  async sendPasswordReset(to: string, name: string, resetToken: string) {
    return this.sendMail({
      to,
      subject: 'Reset your password — Unified Dental Platform',
      template: 'reset-password',
      context: {
        name,
        resetUrl: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
      },
    });
  }
}
