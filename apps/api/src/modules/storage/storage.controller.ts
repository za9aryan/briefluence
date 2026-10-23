import { Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators';
import { sniffImage, StorageService, type UploadKind } from './storage.service';

const MAX_BYTES = 5 * 1024 * 1024;
const KIND_ROLES: Record<UploadKind, string[]> = {
  avatar: ['INFLUENCER'],
  logo: ['BRAND'],
  deal: ['BRAND'],
  portfolio: ['INFLUENCER'],
  offer: ['INFLUENCER'],
  // Support images go through POST /support/attachments (guests too), not here.
  support: [],
};

@ApiTags('uploads')
@Controller('uploads')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post(':kind')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!(kind in KIND_ROLES)) throw new AppError('NOT_FOUND', 'Unknown upload kind');
    if (!KIND_ROLES[kind as UploadKind].includes(user.role))
      throw new AppError('FORBIDDEN', 'Not allowed');
    if (!file) throw new AppError('VALIDATION_FAILED', 'File is required');
    const type = sniffImage(file.buffer);
    if (!type)
      throw new AppError('VALIDATION_FAILED', 'Only PNG, JPEG and WebP images are allowed');
    const url = await this.storage.putImage(kind as UploadKind, file.buffer, type.mime, type.ext);
    return { url };
  }
}
