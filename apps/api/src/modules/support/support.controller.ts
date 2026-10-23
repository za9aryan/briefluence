import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  SUPPORT_BOXES,
  supportAssignSchema,
  supportMessageSchema,
  supportResumeSchema,
  supportStartSchema,
  type SupportAssignInput,
  type SupportBox,
  type SupportMessageData,
  type SupportStartData,
} from '@briefluence/shared';
import type { Response } from 'express';
import { AppError } from '../../common/app-error';
import type { AuthedRequest, AuthUser } from '../../common/auth-user';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { sniffImage, StorageService } from '../storage/storage.service';
import { SUPPORT_COOKIE } from '../../realtime/realtime.gateway';
import { SupportService, type Requester } from './support.service';

const GUEST_COOKIE_DAYS = 180;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const requester = (req: AuthedRequest): Requester => {
  const cookies = (req.cookies ?? {}) as Record<string, string>;
  return {
    user: req.user,
    guestToken: cookies[SUPPORT_COOKIE],
    ip: req.ip,
    locale: cookies.NEXT_LOCALE,
  };
};

/**
 * Support chat for everyone: signed-in users (session cookie) and guests (support cookie).
 * All routes are public; ownership is checked per ticket in the service.
 */
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly storage: StorageService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private setGuestCookie(res: Response, token: string) {
    res.cookie(SUPPORT_COOKIE, token, {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax',
      domain: this.env.COOKIE_DOMAIN,
      path: '/',
      maxAge: GUEST_COOKIE_DAYS * 86_400_000,
    });
  }

  @Public()
  @Get('current')
  current(@Req() req: AuthedRequest) {
    return this.support.current(requester(req));
  }

  @Public()
  @Post('tickets')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiZodBody(supportStartSchema)
  async start(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @ZodBody(supportStartSchema) body: SupportStartData,
  ) {
    const { view, guestToken } = await this.support.start(requester(req), body);
    if (guestToken) this.setGuestCookie(res, guestToken);
    return view;
  }

  @Public()
  @Post('tickets/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(supportMessageSchema)
  message(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @ZodBody(supportMessageSchema) body: SupportMessageData,
  ) {
    return this.support.addMessage(requester(req), id, body);
  }

  @Public()
  @Post('tickets/:id/read')
  @HttpCode(204)
  read(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.support.markRead(requester(req), id);
  }

  /** Continue a guest conversation from the emailed link (works on any device). */
  @Public()
  @Post('resume')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiZodBody(supportResumeSchema)
  async resume(
    @Res({ passthrough: true }) res: Response,
    @ZodBody(supportResumeSchema) { token }: { token: string },
  ) {
    const view = await this.support.resume(token);
    this.setGuestCookie(res, token);
    return view;
  }

  /** Screenshots for support, for users and guests (owner's decision); images only, 5 MB. */
  @Public()
  @Post('attachments')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new AppError('VALIDATION_FAILED', 'File is required');
    const type = sniffImage(file.buffer);
    if (!type)
      throw new AppError('VALIDATION_FAILED', 'Only PNG, JPEG and WebP images are allowed');
    return { url: await this.storage.putImage('support', file.buffer, type.mime, type.ext) };
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/support')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  inbox(@CurrentUser() user: AuthUser, @Query('box') box?: string) {
    const b = SUPPORT_BOXES.includes(box as SupportBox) ? (box as SupportBox) : 'unassigned';
    return this.support.inbox(user.id, b);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.support.detail(id);
  }

  @Post(':id/messages')
  @ApiZodBody(supportMessageSchema)
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(supportMessageSchema) body: SupportMessageData,
  ) {
    return this.support.reply(user.id, id, body);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @ApiZodBody(supportAssignSchema)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(supportAssignSchema) body: SupportAssignInput,
  ) {
    return this.support.assign(user.id, id, body.assigneeId);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id') id: string) {
    return this.support.setClosed(id, true);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  reopen(@Param('id') id: string) {
    return this.support.setClosed(id, false);
  }

  @Post(':id/read')
  @HttpCode(204)
  read(@Param('id') id: string) {
    return this.support.adminRead(id);
  }
}
