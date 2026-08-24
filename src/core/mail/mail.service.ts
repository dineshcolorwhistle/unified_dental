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
  locale?: string;
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
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(this.configService.get<number>('SMTP_PORT')) || 587,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER') || '',
        pass: this.configService.get<string>('SMTP_PASS') || '',
      },
    });
  }

  private renderTemplate(templateName: string, context: Record<string, any>, locale?: string): string {
    const isSpanish = locale?.toLowerCase().startsWith('es');
    const localizedTemplateName = isSpanish ? `${templateName}_es` : templateName;

    const candidates = [
      path.join(__dirname, 'templates', `${localizedTemplateName}.hbs`),
      path.join(process.cwd(), 'src', 'core', 'mail', 'templates', `${localizedTemplateName}.hbs`),
      path.join(process.cwd(), 'dist', 'src', 'core', 'mail', 'templates', `${localizedTemplateName}.hbs`),
      // Fallbacks
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
    const html = this.renderTemplate(options.template, options.context, options.locale);

    this.logger.log(`📧 Sending email to: ${options.to} [Locale: ${options.locale || 'en'}] | Subject: ${options.subject}`);

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html,
      });
      this.logger.log(`✅ Email sent successfully. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve the base URL for a given tenant subdomain or fallback to the primary platform domain.
   * - In local dev (e.g. localhost:5173 or localhost:3000): returns http(s)://{slug}.localhost:5173
   * - In production with BASE_DOMAIN (e.g. app.example.com): returns http(s)://{slug}.app.example.com
   * - If no tenantSlug is passed: returns the primary platform admin domain
   */
  getTenantBaseUrl(tenantSlug?: string): string {
    const rawAppUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:5173';

    if (!tenantSlug) {
      return rawAppUrl.replace(/\/+$/, '');
    }

    const cleanSlug = tenantSlug.toLowerCase().trim();

    try {
      const parsed = new URL(rawAppUrl);
      const protocol = parsed.protocol; // e.g. 'http:' or 'https:'
      const port = parsed.port ? `:${parsed.port}` : '';
      const hostname = parsed.hostname; // e.g. 'localhost' or 'app.example.com'

      const baseDomain =
        this.configService.get<string>('BASE_DOMAIN') ||
        process.env.BASE_DOMAIN;

      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
        return `${protocol}//${cleanSlug}.localhost${port}`;
      } else if (baseDomain && !baseDomain.includes('localhost')) {
        return `${protocol}//${cleanSlug}.${baseDomain}${port}`;
      } else {
        // If hostname has app. or www. prefix, strip it when prepending slug
        const strippedHost = hostname.replace(/^(app\.|www\.)/, '');
        return `${protocol}//${cleanSlug}.${strippedHost}${port}`;
      }
    } catch {
      return `http://${cleanSlug}.localhost:5173`;
    }
  }

  /**
   * Send welcome invite email to a new tenant admin.
   * Includes a "Set Your Password" link on the tenant's subdomain URL.
   * Supports multilingual content (EN/ES) based on locale.
   */
  async sendWelcomeInvite(
    to: string,
    name: string,
    tenantName: string,
    resetToken?: string,
    locale?: string,
    tenantSlug?: string,
  ) {
    const tenantBaseUrl = this.getTenantBaseUrl(tenantSlug);
    const setPasswordUrl = resetToken
      ? `${tenantBaseUrl}/reset-password?token=${resetToken}`
      : `${tenantBaseUrl}/login`;
    const loginUrl = `${tenantBaseUrl}/login`;

    const isSpanish = locale?.toLowerCase().startsWith('es');
    const subject = isSpanish
      ? `¡Bienvenido a ${tenantName} — Plataforma Dental Unificada!`
      : `Welcome to ${tenantName} — Unified Dental Platform`;

    return this.sendMail({
      to,
      subject,
      template: 'welcome',
      locale,
      context: {
        name,
        tenantName,
        tenantSlug,
        subdomainUrl: tenantBaseUrl,
        setPasswordUrl,
        hasResetToken: !!resetToken,
        loginUrl,
      },
    });
  }

  /**
   * Send password reset email with a secure, time-limited reset link.
   * Links to the tenant's isolated subdomain URL.
   * Supports multilingual content (EN/ES) based on locale.
   */
  async sendPasswordReset(
    to: string,
    name: string,
    resetToken: string,
    locale?: string,
    tenantSlug?: string,
  ) {
    const tenantBaseUrl = this.getTenantBaseUrl(tenantSlug);
    const resetUrl = `${tenantBaseUrl}/reset-password?token=${resetToken}`;
    const loginUrl = `${tenantBaseUrl}/login`;

    const isSpanish = locale?.toLowerCase().startsWith('es');
    const subject = isSpanish
      ? 'Restablezca su contraseña — Plataforma Dental Unificada'
      : 'Reset your password — Unified Dental Platform';

    return this.sendMail({
      to,
      subject,
      template: 'reset-password',
      locale,
      context: {
        name,
        resetUrl,
        loginUrl,
        subdomainUrl: tenantBaseUrl,
      },
    });
  }
}
