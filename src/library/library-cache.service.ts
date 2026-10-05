import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Keyv from "keyv";
import KeyvRedis, { createClient } from "@keyv/redis";

@Injectable()
export class LibraryCacheService implements OnModuleInit {
  private readonly logger = new Logger(LibraryCacheService.name);
  private keyv: Keyv | null = null;
  private redisClient: ReturnType<typeof createClient> | null = null;
  // Effective prefix applied by Keyv to every key before it hits Redis
  // (`<namespace>:<key>`). Used by deleteByPattern so callers can supply a
  // logical pattern without having to know the namespace.
  private effectivePrefix = "";
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>("REDIS_HOST");
    if (!host) {
      this.logger.warn(
        "[LibraryCache] REDIS_HOST not set - library cache disabled",
      );
      return;
    }

    const port = this.configService.get<number>("REDIS_PORT", 6379);
    const password = this.configService.get<string>("REDIS_PASSWORD");
    const prefix =
      this.configService.get<string>("REDIS_PREFIX", "medpark:") || "";
    const namespace = prefix.endsWith(":") ? prefix.slice(0, -1) : prefix;

    const auth = password ? `:${encodeURIComponent(password)}@` : "";
    const redisUrl = `redis://${auth}${host}:${port}`;

    try {
      // Create the underlying Redis client explicitly so we can attach an
      // error handler. Without this, if Redis dies while the app is running,
      // @redis/client emits an 'error' on its own EventEmitter with no
      // listener → Node crashes the whole process.
      //
      // (The previous version of this file attached `keyv.on('error', ...)`,
      // but Keyv doesn't re-emit errors from the underlying RedisClient, so
      // socket-close events still bubbled up unhandled.)
      const client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error(
                `[LibraryCache] Redis reconnect gave up after ${retries} attempts`,
              );
              return false;
            }
            const delay = Math.min(50 * Math.pow(2, retries), 5000);
            return delay;
          },
        },
      });

      // Required: 'error' MUST have a listener or Node crashes.
      client.on("error", (err) => {
        this.logger.warn(
          `[LibraryCache] Redis client error: ${err?.message || err}`,
        );
        // Mark as disabled so get/set/del short-circuit while disconnected.
        this.enabled = false;
      });
      client.on("reconnecting", () => {
        this.logger.warn(
          "[LibraryCache] Redis client attempting to reconnect…",
        );
      });
      client.on("ready", () => {
        this.logger.log("[LibraryCache] Redis client ready");
        this.enabled = true;
      });
      client.on("end", () => {
        this.logger.warn("[LibraryCache] Redis client connection closed");
        this.enabled = false;
      });

      await client.connect();

      const store = new KeyvRedis(client as any);
      this.keyv = new Keyv({ store, namespace: namespace || undefined });
      this.keyv.on("error", (err) => {
        this.logger.warn(`[LibraryCache] Keyv error: ${err?.message || err}`);
      });

      this.redisClient = client;
      // Keyv-redis stores keys as `<namespace>:<logicalKey>` on the Redis
      // side. Capture the prefix so deleteByPattern can build a matching
      // pattern regardless of what the caller passes.
      this.effectivePrefix = namespace ? `${namespace}:` : "";
      this.enabled = true;
      this.logger.log(
        `[LibraryCache] Redis enabled for library cache (${host}:${port}) namespace=${namespace || "(none)"}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[LibraryCache] Failed to initialize Redis cache: ${error?.message || error}`,
      );
      this.enabled = false;
      this.keyv = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.keyv) return null;
    try {
      return (await this.keyv.get(key)) as T | null;
    } catch (error: any) {
      this.logger.warn(
        `[LibraryCache] GET failed for ${key}: ${error?.message || error}`,
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.enabled || !this.keyv) return;
    try {
      await this.keyv.set(key, value, ttlMs);
    } catch (error: any) {
      this.logger.warn(
        `[LibraryCache] SET failed for ${key}: ${error?.message || error}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.keyv) return;
    try {
      await this.keyv.delete(key);
    } catch (error: any) {
      this.logger.warn(
        `[LibraryCache] DEL failed for ${key}: ${error?.message || error}`,
      );
    }
  }

  /**
   * Delete every key matching a glob pattern. Uses SCAN so large keyspaces
   * are safe (never KEYS *). Pattern is the LOGICAL key form — the namespace
   * prefix is added automatically.
   *
   * Returns the number of keys deleted (0 when cache is disabled).
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.enabled || !this.redisClient) return 0;
    const fullPattern = `${this.effectivePrefix}${pattern}`;
    let deleted = 0;
    try {
      const iterator = this.redisClient.scanIterator({
        MATCH: fullPattern,
        COUNT: 500,
      });
      const batch: string[] = [];
      for await (const key of iterator) {
        // node-redis v4 SCAN can yield string or string[] depending on version.
        if (Array.isArray(key)) batch.push(...key);
        else batch.push(key);
        if (batch.length >= 500) {
          deleted += await this.redisClient.del(batch);
          batch.length = 0;
        }
      }
      if (batch.length > 0) {
        deleted += await this.redisClient.del(batch);
      }
      this.logger.log(
        `[LibraryCache] deleteByPattern("${pattern}") removed ${deleted} keys`,
      );
      return deleted;
    } catch (error: any) {
      this.logger.warn(
        `[LibraryCache] deleteByPattern("${pattern}") failed: ${error?.message || error}`,
      );
      return deleted;
    }
  }
}
