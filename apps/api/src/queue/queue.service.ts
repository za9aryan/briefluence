import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

export type JobHandler<T = unknown> = (data: T) => Promise<void>;

const QUEUE_NAME = 'briefluence';

/**
 * Background jobs (emails, stats sync, renewals). Uses BullMQ when REDIS_URL is set; otherwise
 * runs jobs in-process right after the request (dev/test only) so a missing Redis never blocks.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;
  private readonly pending = new Set<Promise<void>>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  get usesRedis(): boolean {
    return !!this.env.REDIS_URL;
  }

  register<T>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler);
  }

  onModuleInit() {
    if (!this.env.REDIS_URL) {
      if (this.env.NODE_ENV === 'production') throw new Error('REDIS_URL is required in production');
      this.logger.log('REDIS_URL not set: running jobs in-process');
      return;
    }
    this.connection = new IORedis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    if (this.env.PROCESS_ROLE !== 'api') this.startWorker();
  }

  private startWorker() {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) throw new Error(`No handler for job ${job.name}`);
        await handler(job.data);
      },
      { connection: this.connection!, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.name} failed: ${err.message}`));
    this.logger.log('BullMQ worker started');
  }

  async add<T>(name: string, data: T, opts?: JobsOptions): Promise<void> {
    if (this.queue) {
      await this.queue.add(name, data, opts);
      return;
    }
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`No handler for job ${name}`);
    const run = (async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await handler(data);
          return;
        } catch (err) {
          this.logger.error(`Job ${name} attempt ${attempt} failed: ${(err as Error).message}`);
        }
      }
    })();
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
  }

  /** Waits for in-process jobs to finish (tests). */
  async drain(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  async onModuleDestroy() {
    await this.drain();
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
