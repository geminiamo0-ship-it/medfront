import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EncryptionService } from './encryption.service';

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  constructor(private readonly enc: EncryptionService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    // Only process HTTP — WebSocket / GraphQL contexts have no Response object.
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();

    // Extract the raw JWT from the Authorization header.
    // If absent (unauthenticated routes like /auth/login), skip encryption —
    // those responses contain no sensitive question/answer content.
    const authHeader = req.headers['authorization'] as string | undefined;
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    return next.handle().pipe(
      map((data) => {
        if (data == null)           return data;
        if (Buffer.isBuffer(data))  return data;
        // Never encrypt error responses — keep them readable for debugging.
        // AllExceptionsFilter writes errors via res.json() so they never reach
        // here in practice, but this guard makes the intent explicit.
        if (res.statusCode >= 400)  return data;
        // Skip unauthenticated responses — no JWT means no derived key.
        if (!jwt)                   return data;

        return { enc: true, v: this.enc.encrypt(JSON.stringify(data), jwt) };
      }),
    );
  }
}
