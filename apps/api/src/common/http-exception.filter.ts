import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody, ErrorCode } from '@briefluence/shared';
import type { Response } from 'express';
import { AppError } from './app-error';

const BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    if (exception instanceof ThrottlerException) {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const message = typeof r === 'string' ? r : ((r as { message?: string }).message ?? exception.message);
      const body: ApiErrorBody = {
        error: { code: BY_STATUS[status] ?? 'INTERNAL', message: String(message) },
      };
      res.status(status).json(body);
      return;
    }
    // Never echo internal error messages (may contain secrets or SQL) to the client.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: { code: 'INTERNAL', message: 'Something went wrong' } } satisfies ApiErrorBody);
  }
}
