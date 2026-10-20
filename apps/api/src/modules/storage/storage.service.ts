import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';

export type UploadKind = 'avatar' | 'logo' | 'deal' | 'portfolio' | 'offer';

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

/** Detects the real image type from magic bytes; the client-sent content type is not trusted. */
export function sniffImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

@Injectable()
export class StorageService {
  private readonly s3?: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.STORAGE_DRIVER === 's3') {
      this.s3 = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: !!env.S3_ENDPOINT,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        },
      });
    }
  }

  /** Public URL prefix of uploads of this kind (S3 bucket or the API's own /files route). */
  private base(kind: UploadKind) {
    const root = this.s3
      ? this.env.S3_PUBLIC_URL!.replace(/\/$/, '')
      : `${this.env.API_URL}/api/v1/files`;
    return `${root}/${kind}/`;
  }

  /** True when the URL points at a file we stored for this kind (not a hotlink to anywhere). */
  isOwnUpload(url: string, kind: UploadKind): boolean {
    const base = this.base(kind);
    return url.startsWith(base) && /^[\w-]+\.(png|jpg|webp)$/.test(url.slice(base.length));
  }

  async putImage(kind: UploadKind, buf: Buffer, mime: string, ext: string): Promise<string> {
    const key = `${kind}/${randomUUID()}.${ext}`;
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.env.S3_BUCKET,
          Key: key,
          Body: buf,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${this.base(kind)}${key.slice(kind.length + 1)}`;
    }
    const dir = join(process.cwd(), 'uploads', kind);
    await mkdir(dir, { recursive: true });
    await writeFile(join(process.cwd(), 'uploads', key), buf);
    return `${this.base(kind)}${key.slice(kind.length + 1)}`;
  }
}
