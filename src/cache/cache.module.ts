import { Module, Global, Logger } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Keyv from "keyv";
import KeyvRedis, { createClient } from "@keyv/redis";

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<any> => {
        const logger = new Logger("CacheConfigModule");
        const nodeEnv = configService.get<string>("NODE_ENV", "development");
        const isProduction = nodeEnv === "production";
        const redisHost = configService.get<string>("REDIS_HOST");
        const ttlMs = configService.get<number>("REDIS_TTL", 3600) * 1000;

        if (!redisHost) {
          if (isProduction) {
            throw new Error(
              "REDIS_HOST is required in production. Refusing to start with in-memory cache.",
            );
          }

          logger.warn(
            "No REDIS_HOST configured - using in-memory Keyv cache in non-production",
          );
          return {
            ttl: ttlMs,
          };
        }

        try {
          const password = configService.get<string>("REDIS_PASSWORD");
          const port = configService.get<number>("REDIS_PORT", 6379);
          const prefix =
            configService.get<string>("REDIS_PREFIX", "medpark:") || "";
          const namespace = prefix.endsWith(":") ? prefix.slice(0, -1) : prefix;
          const auth = password ? `:${encodeURIComponent(password)}@` : "";
          const redisUrl = `redis://${auth}${redisHost}:${port}`;

          // Create the underlying Redis client explicitly so we can attach an
          // error handler to it. Without this, if Redis goes down while the
          // app is running, @redis/client emits an 'error' on its own
          // EventEmitter with no listener → Node crashes the whole process.
          //
          // We also configure an exponential reconnect strategy so the
          // client keeps trying to reach Redis after a transient outage.
          const client = createClient({
            url: redisUrl,
            socket: {
              // Reconnect attempts: exponential backoff capped at 5s,
              // giving up after ~20 attempts (~minute and a half).
              reconnectStrategy: (retries) => {
                if (retries > 10) {
                  logger.error(
                    `Redis reconnect gave up after ${retries} attempts`,
                  );
                  return false;
                }
                const delay = Math.min(50 * Math.pow(2, retries), 5000);
                return delay;
              },
            },
          });

          // CRITICAL: this listener prevents Node from crashing when Redis
          // disconnects. The error event MUST be handled — see Node docs on
          // EventEmitter error semantics.
          client.on("error", (err) => {
            logger.warn(`Redis client error: ${err?.message || err}`);
          });
          client.on("reconnecting", () => {
            logger.warn("Redis client attempting to reconnect…");
          });
          client.on("ready", () => {
            logger.log("Redis client ready");
          });
          client.on("end", () => {
            logger.warn("Redis client connection closed");
          });

          await client.connect();

          const store = new KeyvRedis(client as any);
          const keyv = new Keyv({
            store,
            ttl: ttlMs,
            namespace: namespace || undefined,
          });

          // Secondary safety net — also handle errors that Keyv re-emits.
          keyv.on("error", (error) => {
            logger.warn(`Keyv error: ${error?.message || error}`);
          });

          // Probe the connection to confirm we're talking to Redis before
          // letting the app boot.
          const probeKey = `__cache_probe__:${Date.now()}`;
          await keyv.set(probeKey, "ok", 1000);
          await keyv.delete(probeKey);

          logger.log(
            `Redis Keyv connected to ${redisHost}:${port} namespace="${namespace || "(none)"}"`,
          );

          return {
            stores: [keyv],
            ttl: ttlMs,
          };
        } catch (error: any) {
          if (isProduction) {
            throw new Error(
              `Redis connection failed in production: ${error?.message || error}`,
            );
          }

          logger.error(
            `Redis connection failed: ${error?.message || error} - falling back to in-memory Keyv cache in non-production`,
          );
          return {
            ttl: ttlMs,
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class CacheConfigModule {}
