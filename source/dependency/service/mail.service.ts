import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return !!(this.configService.get<string>('mail.host') && this.configService.get<string>('mail.from'));
  }

  private get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  private get appName(): string {
    return this.configService.get<string>('app.name', 'Horologe');
  }

  private getTransporter(): Transporter {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Email delivery is not configured');
    }
    if (!this.transporter) {
      const user = this.configService.get<string>('mail.user');
      const password = this.configService.get<string>('mail.password');
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port', 587),
        secure: this.configService.get<boolean>('mail.secure', false),
        ...(user && password ? { auth: { user, pass: password } } : {}),
      });
    }
    return this.transporter;
  }

  async send({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }): Promise<void> {
    if (!this.isConfigured && !this.isProduction) {
      // Development without SMTP: log instead of failing so flows can be tested.
      this.logger.warn(`[mail disabled] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.getTransporter().sendMail({
      from: this.configService.get<string>('mail.from'),
      to,
      subject,
      text,
      html,
    });
  }

  private layout(title: string, body: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a">
<h2 style="color:#0f172a;letter-spacing:2px">${escapeHtml(this.appName)}</h2><h3>${escapeHtml(title)}</h3>${body}
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated message. Please do not reply.</p></div>`;
  }

  async sendVerificationCode({ email, code, minutes }: { email: string; code: number; minutes: number }): Promise<void> {
    await this.send({
      to: email,
      subject: 'Verify your email address',
      text: `Your ${this.appName} verification code is ${code}. It expires in ${minutes} minutes.`,
      html: this.layout(
        'Verify your email address',
        `<p>Your verification code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>It expires in ${minutes} minutes.</p>`,
      ),
    });
  }

  async sendPasswordReset({ email, link, minutes }: { email: string; link: string; minutes: number }): Promise<void> {
    await this.send({
      to: email,
      subject: 'Reset your password',
      text: `Reset your ${this.appName} password using this link (valid for ${minutes} minutes, single use): ${link}\nIf you did not request this, ignore this email.`,
      html: this.layout(
        'Reset your password',
        `<p><a href="${escapeHtml(link)}">Click here to reset your password</a>.</p><p>The link works once and expires in ${minutes} minutes. If you did not request this, ignore this email.</p>`,
      ),
    });
  }

  async sendPasswordChanged({ email, name }: { email: string; name: string }): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your password was changed',
      text: `Hello ${name},\n\nThe password for your ${this.appName} account was just changed. If this wasn't you, reset your password right away.`,
      html: this.layout(
        'Your password was changed',
        `<p>Hello ${escapeHtml(name)},</p><p>The password for your account was just changed. If this wasn't you, reset your password right away.</p>`,
      ),
    });
  }
}
