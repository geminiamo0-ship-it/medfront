/**
 * Local health monitor — run from your dev machine to ping production.
 *
 * Acts as a third watchdog alongside Cloudflare Cron + any external service.
 *
 * Usage:
 *   npm run health:watch
 *
 * Reads from .env (or env vars):
 *   PROD_HEALTH_URL        — defaults to https://api.medpark.io/api/health
 *   TELEGRAM_BOT_TOKEN     — your bot token
 *   TELEGRAM_ADMIN_CHAT_ID — chat to send alerts to
 *   HEALTH_INTERVAL_MIN    — check interval in minutes (default: 5)
 */

import { config } from 'dotenv';
config();

import axios from 'axios';

const PROD_URL    = process.env.PROD_HEALTH_URL    || 'https://api.medpark.io/api/health';
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID     = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const INTERVAL_MS = (Number(process.env.HEALTH_INTERVAL_MIN) || 5) * 60 * 1000;

// Track last known status to suppress duplicate alerts
let lastStatus: 'ok' | 'degraded' | 'down' | 'unreachable' = 'ok';

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[monitor] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set — skipping alert');
    return;
  }
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true },
    );
  } catch (err: any) {
    console.error(`[monitor] Failed to send Telegram alert: ${err.message}`);
  }
}

async function ping(): Promise<void> {
  const ts = new Date().toUTCString();
  try {
    const res  = await axios.get<any>(PROD_URL, { timeout: 12_000 });
    const data = res.data as { status?: string; db?: any; redis?: any };

    if (data.status === 'ok') {
      if (lastStatus !== 'ok') {
        // Recovered — send a recovery notice
        console.log(`[${ts}] ✅ Production recovered (was ${lastStatus})`);
        await sendTelegram(
          `✅ <b>MedPark Production Recovered</b>\n` +
          `Previous status: <b>${lastStatus}</b>\n` +
          `🕐 ${ts}`,
        );
      } else {
        console.log(`[${ts}] ✅ OK — DB ${data.db?.latencyMs ?? '?'}ms · Redis ${data.redis?.latencyMs ?? '?'}ms`);
      }
      lastStatus = 'ok';
    } else {
      const icon = data.status === 'down' ? '🔴' : '🟠';
      console.warn(`[${ts}] ${icon} Health ${data.status?.toUpperCase()}`);
      if (lastStatus !== data.status) {
        await sendTelegram(
          `${icon} <b>MedPark Health Alert (dev monitor)</b>\n\n` +
          `Status: <b>${data.status}</b>\n` +
          `🗄 DB: ${data.db?.ok ? `✅ ok (${data.db.latencyMs}ms)` : `❌ ${data.db?.error ?? 'down'}`}\n` +
          `⚡ Redis: ${data.redis?.ok ? `✅ ok (${data.redis.latencyMs}ms)` : `❌ ${data.redis?.error ?? 'down'}`}\n` +
          `🕐 ${ts}`,
        );
      }
      lastStatus = data.status as any;
    }
  } catch (err: any) {
    console.error(`[${ts}] 🔴 Unreachable — ${err.message}`);
    if (lastStatus !== 'unreachable') {
      await sendTelegram(
        `🔴 <b>MedPark Production Unreachable (dev monitor)</b>\n\n` +
        `<code>${err.message}</code>\n` +
        `🕐 ${ts}`,
      );
    }
    lastStatus = 'unreachable';
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`🔍 Monitoring ${PROD_URL} every ${INTERVAL_MS / 60_000} min`);
console.log(`📣 Telegram alerts: ${BOT_TOKEN && CHAT_ID ? 'enabled' : 'DISABLED (env vars missing)'}`);
console.log('─'.repeat(60));

void ping(); // immediate first check
setInterval(() => void ping(), INTERVAL_MS);
