import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { TelegramService } from './integrations/telegram.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { applyHelmet } from './security/helmet.config';

// Singletons: one NestJS app per Worker isolate
let expressApp: express.Express;
let nestApp:    INestApplication;
let appPromise: Promise<void> | null = null;

function bootstrap(env: Record<string, string>): Promise<void> {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') {
        process.env[key] = value;
      }
    }

    expressApp = express();

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { logger: ['error', 'warn', 'log'] },
    );

    // Security headers must wrap every response in the Worker path too.
    applyHelmet(app);

    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin.trim() === '') {
      throw new Error(
        'CRITICAL: CORS_ORIGIN environment variable is missing. ' +
          'It is strictly required — refusing to start with a wildcard origin alongside credentials.',
      );
    }

    app.enableCors({
      origin: corsOrigin
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      credentials: true,
    });

    app.setGlobalPrefix(process.env.API_PREFIX || 'api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // AllExceptionsFilter registered via APP_FILTER in AppModule.
    // Swagger skipped in Worker deployment.

    await app.init();
    nestApp = app;

    // Startup notification — rate-limited to once per 5 min
    try {
      const cache    = nestApp.get<Cache>(CACHE_MANAGER);
      const telegram = nestApp.get(TelegramService);
      const already  = await cache.get('startup:notified');
      if (!already) {
        await cache.set('startup:notified', '1', 5 * 60 * 1000);
        void telegram.sendStartupAlert().catch(() => {});
      }
    } catch {
      // Non-critical
    }
  })();

  return appPromise;
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  return new Promise<Response>(async (resolve, reject) => {
    try {
      const socket = new Socket();
      const req = new IncomingMessage(socket);

      req.method = request.method;
      req.url = url.pathname + url.search;

      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
      req.headers = headers;

      if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
        const bodyBuffer = Buffer.from(await request.arrayBuffer());
        req.push(bodyBuffer);
      }
      req.push(null);

      const res = new ServerResponse(req);
      const chunks: Buffer[] = [];
      const origWrite = res.write;
      const origEnd   = res.end;

      res.write = function (chunk: any, ...args: any[]) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return origWrite.apply(res, [chunk, ...args] as any);
      } as any;

      res.end = function (chunk?: any, ...args: any[]) {
        if (chunk && chunk.length > 0)
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        const body = Buffer.concat(chunks);
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(res.getHeaders())) {
          if (value !== undefined) {
            Array.isArray(value)
              ? value.forEach(v => responseHeaders.append(key, String(v)))
              : responseHeaders.set(key, String(value));
          }
        }

        resolve(new Response(body.length > 0 ? body : null, {
          status:     res.statusCode,
          statusText: res.statusMessage || '',
          headers:    responseHeaders,
        }));

        return origEnd.apply(res, [chunk, ...args] as any);
      } as any;

      expressApp(req as any, res as any);
    } catch (err) {
      reject(err);
    }
  });
}

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    try {
      await bootstrap(env);
      return await handleRequest(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Worker failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
};
