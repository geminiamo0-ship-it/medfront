/**
 * Verifies that the frontend decryption (src/lib/crypto.ts) exactly matches the
 * backend EncryptionService. We re-implement the backend's Node crypto routine
 * here, encrypt a payload with a known JWT, then decrypt it with the real
 * frontend function and assert a perfect round-trip.
 *
 * Run: node scripts/verify-crypto.ts
 */
import { createHmac, createCipheriv, randomBytes, webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

import { decryptPayload } from '../src/lib/crypto.ts';

const SALT = ':medpark-response-enc-v1';

function backendEncrypt(plaintext: string, jwt: string): string {
  const key = createHmac('sha256', SALT).update(jwt).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const part1 = cipher.update(plaintext, 'utf8');
  const part2 = cipher.final();
  const tag = cipher.getAuthTag();
  const out = Buffer.allocUnsafe(12 + part1.length + part2.length + 16);
  iv.copy(out, 0);
  part1.copy(out, 12);
  part2.copy(out, 12 + part1.length);
  tag.copy(out, 12 + part1.length + part2.length);
  return out.toString('base64');
}

const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.payload.signature';

const payload = {
  success: true,
  data: { userId: 42, name: 'Test User', rating: 1654, unicode: 'α-βγ-دمشق' },
  nested: { arr: [1, 2, 3], flag: true, nil: null },
};

const v = backendEncrypt(JSON.stringify(payload), jwt);
const decrypted = await decryptPayload<typeof payload>({ enc: true, v }, jwt);

const a = JSON.stringify(payload);
const b = JSON.stringify(decrypted);

if (a === b) {
  console.log('ROUNDTRIP OK — frontend decryption matches backend encryption');
  console.log('decrypted:', b);
} else {
  console.error('MISMATCH');
  console.error('expected:', a);
  console.error('got     :', b);
  process.exit(1);
}