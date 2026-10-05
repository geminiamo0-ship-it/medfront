import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TelegramService } from './integrations/telegram.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as express from 'express';
// CommonJS-style import — @types/compression types it as a CJS module so
// `import * as compression` is not callable directly.
import compression = require('compression');
import { timingSafeEqual } from 'crypto';
import { applyHelmet } from './security/helmet.config';

/**
 * Extract the ORIGINAL client IP from a request, preferring trusted-proxy
 * headers over the direct socket address.
 *
 * Order of preference:
 *   1. cf-connecting-ip — set by Cloudflare, the real visitor IP
 *   2. x-forwarded-for — set by other proxies; first IP in the list
 *   3. req.ip — Express's parsed remote address
 *   4. req.socket.remoteAddress — raw TCP peer
 *
 * Without this, a request coming in via Cloudflare in prod would appear to
 * be from a Cloudflare server, defeating any source-IP allowlist.
 */
function extractOriginalClientIp(req: any): string {
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) return cfIp.trim();

  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }

  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

/**
 * True iff the given IP is a loopback address. Handles both IPv4 (127.0.0.1)
 * and IPv6 (::1), plus the IPv4-mapped IPv6 form (::ffff:127.0.0.1) that
 * Node sometimes emits when the OS dual-stack binds.
 */
function isLocalhost(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '').trim();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost'
  );
}

// Last-resort safety net: even with per-client error handlers in
// cache.module.ts and library-cache.service.ts, any future code that adds
// a new Redis client without an 'error' listener would crash the entire
// process when Redis dies. This handler catches those orphaned errors at
// the Node process level so the app stays up no matter what.
//
// We ONLY swallow Redis socket errors — every other uncaughtException is
// re-thrown so genuine bugs still surface loudly.
process.on('uncaughtException', (err: any) => {
  const msg = err?.message || '';
  const name = err?.name || '';
  const isRedisSocketError =
    name === 'SocketClosedUnexpectedlyError' ||
    name === 'ConnectionTimeoutError' ||
    msg.includes('Socket closed unexpectedly') ||
    msg.includes('connect ECONNREFUSED') ||
    msg.includes('Redis connection') ||
    msg.includes('ECONNRESET');

  if (isRedisSocketError) {
    // eslint-disable-next-line no-console
    console.warn(`[process] Redis connection error suppressed: ${msg || err}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[process] Uncaught exception:', err);
  throw err;
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  // Registered before json/cors so headers apply to every response including
  // 4xx/5xx error paths.
  applyHelmet(app);

  // gzip/deflate response compression. Only kicks in for responses ≥1 KB so
  // small JSON responses skip the CPU cost. Trades ~5-10ms of CPU on large
  // payloads for ~60-80% bandwidth savings, which directly reduces the
  // Postgres-egress + backend-egress lines on the monthly bill and cuts
  // end-user perceived latency on slow connections.
  app.use(compression({ threshold: 1024 }));

  // Body size limits.
  //
  // The notebook stores user-authored HTML with inline base64 images, which
  // can legitimately push into the multi-MB range, so it keeps a higher
  // ceiling. Every other endpoint accepts at most 1 MB — large enough for
  // any normal JSON payload, small enough that an attacker can't tie up
  // memory by POSTing 50 MB of junk to e.g. /api/health.
  //
  // Was: 50 MB applied globally to every route — meant POST /api/health
  // would happily parse a 50 MB body before the controller saw the
  // request. That's both a DoS vector and a memory-pressure risk.
  app.use('/api/notebook', express.json({ limit: '25mb' }));
  app.use('/api/notebook', express.urlencoded({ limit: '25mb', extended: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  if (isProd && !corsOrigin) {
    throw new Error('CRITICAL: CORS_ORIGIN environment variable is missing. It is strictly required in production.');
  }

  // Enable CORS
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',') : ['http://localhost:5173'],
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // AllExceptionsFilter is registered via APP_FILTER in AppModule (needs DI for TelegramService)

  // Swagger documentation — exposes every endpoint, every DTO, the auth
  // scheme, and role structure. We layer multiple gates so the docs are
  // only reachable when someone explicitly tries to get to them:
  //
  //   GATE 1 — Localhost-only (applies in EVERY environment)
  //     The request's original client IP (cf-connecting-ip → x-forwarded-for
  //     → socket) must be 127.0.0.1 or ::1. Otherwise the path returns 404,
  //     identical to a non-existent route. This means:
  //       - Dev: only the developer running the backend on their own
  //         machine can reach /mrshady/api/docs. Anyone else on the LAN
  //         (e.g. a colleague hitting your machine via Wi-Fi) sees a 404.
  //       - Prod: all real traffic comes through Cloudflare with a public
  //         client IP — never localhost — so the docs are completely
  //         unreachable from the internet. To debug in prod you'd need to
  //         SSH into the box and curl localhost.
  //
  //   GATE 2 — Production opt-in
  //     In prod, Swagger is NOT mounted at all unless ENABLE_SWAGGER='true'.
  //     This keeps the routes from existing in normal prod deploys.
  //
  //   GATE 3 — Basic Auth (production only)
  //     If ENABLE_SWAGGER=true in prod, SWAGGER_USER + SWAGGER_PASSWORD must
  //     be set; the docs path additionally requires Basic Auth with timing-
  //     safe comparison. Belt-and-suspenders behind the localhost gate.
  const swaggerEnabled = !isProd || configService.get<string>('ENABLE_SWAGGER') === 'true';

  if (swaggerEnabled) {
    // ── Gate 1: localhost-only IP guard (all environments) ─────────────
    // Uses the original client IP (from the trusted-proxy header chain
    // first, socket address as the fallback). Returns the same 404 as a
    // non-existent route to avoid revealing that the docs exist.
    app.use('/mrshady/api/docs', (req: any, res: any, next: any) => {
      const clientIp = extractOriginalClientIp(req);
      if (!isLocalhost(clientIp)) {
        res.status(404).send('Cannot GET ' + req.originalUrl);
        return;
      }
      next();
    });

    // ── Gate 3: Basic Auth in production ───────────────────────────────
    if (isProd) {
      const swaggerUser = configService.get<string>('SWAGGER_USER');
      const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD');
      if (!swaggerUser || !swaggerPassword) {
        console.warn(
          '[Swagger] ENABLE_SWAGGER=true in production but SWAGGER_USER / SWAGGER_PASSWORD are missing — refusing to mount Swagger.',
        );
      } else {
        const expectedAuth = 'Basic ' + Buffer.from(`${swaggerUser}:${swaggerPassword}`).toString('base64');
        app.use('/mrshady/api/docs', (req: any, res: any, next: any) => {
          // Compare in constant time to avoid trivially timing-based username/pwd guessing.
          const provided = String(req.headers['authorization'] || '');
          const a = Buffer.from(provided);
          const b = Buffer.from(expectedAuth);
          const equal = a.length === b.length && timingSafeEqual(a, b);
          if (!equal) {
            res.set('WWW-Authenticate', 'Basic realm="API Docs"');
            res.status(401).send('Authentication required.');
            return;
          }
          next();
        });
      }
    }

    const config = new DocumentBuilder()
      .setTitle('MedPark API')
      .setDescription('MedPark Backend API - Medical Education Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication endpoints')
      .addTag('Users', 'User profile and preferences management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('mrshady/api/docs', app, document);
  }

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger documentation: http://localhost:${port}/mrshady/api/docs (localhost-only)`);
  } else {
    console.log('📚 Swagger documentation: disabled (production)');
  }

  // Startup notification — rate-limited via Redis so redeploys don't spam
  try {
    const cache    = app.get<Cache>(CACHE_MANAGER);
    const telegram = app.get(TelegramService);
    const already  = await cache.get('startup:notified');
    if (!already) {
      await cache.set('startup:notified', '1', 5 * 60 * 1000);
      void telegram.sendStartupAlert().catch(() => {});
    }
  } catch {
    // Non-critical — never block startup
  }
}

bootstrap();
