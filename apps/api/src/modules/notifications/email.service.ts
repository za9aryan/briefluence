import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import type { RenderedEmail } from './emails/templates';

export interface EmailJob extends RenderedEmail {
  to: string;
}

export const EMAIL_JOB = 'email.send';

/** Emails always go through the queue so a slow mail server never blocks a request. */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private smtp?: Transporter;
  /** Last emails sent with the "log" transport, for tests and local debugging. */
  readonly outbox: EmailJob[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register<EmailJob>(EMAIL_JOB, (job) => this.deliver(job));
    if (this.env.EMAIL_TRANSPORT === 'smtp') {
      this.smtp = nodemailer.createTransport({
        host: this.env.SMTP_HOST,
        port: this.env.SMTP_PORT,
        secure: this.env.SMTP_PORT === 465,
        auth: this.env.SMTP_USER
          ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD }
          : undefined,
      });
    }
  }

  async send(to: string, email: RenderedEmail): Promise<void> {
    await this.queue.add<EmailJob>(EMAIL_JOB, { to, ...email });
  }

  private async deliver(job: EmailJob): Promise<void> {
    switch (this.env.EMAIL_TRANSPORT) {
      case 'smtp':
        await this.smtp!.sendMail({
          from: this.env.EMAIL_FROM,
          to: job.to,
          subject: job.subject,
          html: job.html,
          text: job.text,
        });
        return;
      case 'resend': {
        // https://resend.com/docs/api-reference/emails/send-email
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.env.EMAIL_FROM,
            to: [job.to],
            subject: job.subject,
            html: job.html,
            text: job.text,
          }),
        });
        if (!res.ok) throw new Error(`Resend responded ${res.status}`);
        return;
      }
      case 'log': {
        this.outbox.push(job);
        if (this.outbox.length > 200) this.outbox.shift();
        if (this.env.NODE_ENV === 'test') return;
        const dir = join(process.cwd(), '.emails');
        await mkdir(dir, { recursive: true });
        const file = join(dir, `${Date.now()}-${job.to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
        await writeFile(file, job.html);
        // Do not log the body: verification and reset links carry tokens.
        this.logger.log(`[email:log] to=${job.to} subject="${job.subject}" saved=${file}`);
        return;
      }
    }
  }
}
