import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { TelegramService } from '../integrations/telegram.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly telegram: TelegramService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Only handle HTTP context — skip WebSocket / GraphQL
    if (host.getType() !== 'http') return;

    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error   = 'Internal Server Error';
    let details: any = null;
    let extra: Record<string, any> = {};
    let dbDetail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error   = (exceptionResponse as any).error   || error;
        details = (exceptionResponse as any).details  || null;
        extra   = Object.entries(exceptionResponse as Record<string, any>).reduce(
          (acc, [key, value]) => {
            if (['message', 'error', 'details', 'statusCode'].includes(key)) return acc;
            acc[key] = value;
            return acc;
          },
          {} as Record<string, any>,
        );
      }
    } else if (exception instanceof QueryFailedError) {
      // TypeORM database error — extract the full PostgreSQL detail
      message = exception.message;
      error   = 'QueryFailedError';
      details = exception.stack;

      const driver = (exception as any).driverError;
      if (driver) {
        // driverError.detail: e.g. 'Key (user_id, test_id)=(42, 7) already exists.'
        // driverError.message: the raw pg error
        // driverError.code: postgres error code (e.g. '23505' = unique violation)
        const parts: string[] = [];
        if (driver.code)    parts.push(`Code: ${driver.code}`);
        if (driver.detail)  parts.push(driver.detail);
        if (driver.message && driver.message !== exception.message)
          parts.push(driver.message);
        if (parts.length) dbDetail = parts.join(' — ');
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error   = exception.name;
      details = exception.stack;
    }

    // Short unique ID so users can quote it in support tickets
    const errorId = Math.random().toString(36).slice(2, 10);

    // Enrich context — captured on every error
    const user      = (request as any).user;
    const userId    = user?.id    ?? user?.userId ?? undefined;
    const userEmail = user?.email ?? undefined;
    const userName  = user?.name  ?? undefined;
    const ip        = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                      ?? request.ip
                      ?? undefined;
    const userAgent = request.headers['user-agent'] ?? undefined;

    // Sanitize body
    const sanitizedBody = request.body ? { ...request.body } : undefined;
    if (sanitizedBody?.highlights)     sanitizedBody.highlights     = '[REDACTED]';
    if (sanitizedBody?.questionHtml)   sanitizedBody.questionHtml   = '[REDACTED]';
    if (sanitizedBody?.explanationHtml) sanitizedBody.explanationHtml = '[REDACTED]';

    // Always log the full stack server-side (never in HTTP response)
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `❌ ${request.method} ${request.url} — ${status} [${errorId}]`,
      {
        errorId, error, message, dbDetail,
        userId, userEmail, userName, ip, userAgent,
        body: sanitizedBody,
        params: request.params,
        query:  request.query,
        stack,
        timestamp: new Date().toISOString(),
      },
    );

    // Telegram alert for 500 errors — fire-and-forget, never blocks response
    if (status === 500) {
      void this.telegram.sendErrorAlert({
        errorId,
        method:    request.method,
        url:       request.url,
        errorType: error,    // e.g. "TypeError", "QueryFailedError", "Error"
        message,
        stack,
        dbDetail,
        userId,
        userName,
        userEmail,
        ip,
        userAgent,
      }).catch(() => {});
    }

    response.status(status).json({
      statusCode: status,
      errorId,
      error,
      message,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
      timestamp: new Date().toISOString(),
      path:   request.url,
      method: request.method,
      ...extra,
    });
  }
}
