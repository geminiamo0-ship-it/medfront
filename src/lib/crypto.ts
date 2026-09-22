/**
 * Response decryption — must byte-match the backend EncryptionService.
 *
 * Backend (src/encryption/encryption.service.ts):
 *   key       = HMAC-SHA256(key = ":medpark-response-enc-v1", data = jwt)
 *   wire      = base64( iv[12] || ciphertext || authTag[16] )
 *   algorithm = aes-256-gcm
 *
 * The JWT sent in the Authorization header is the exact value used as the HMAC
 * message, so every decrypted call must pass the same token that was sent.
 */
const KDF_SALT = ':medpark-response-enc-v1';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedPayload {
  enc: true;
  v: string;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).enc === true &&
    typeof (value as Record<string, unknown>).v === 'string'
  );
}

async function deriveKey(jwt: string): Promise<CryptoKey> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(KDF_SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const keyBytes = await crypto.subtle.sign('HMAC', hmacKey, textEncoder.encode(jwt));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function decryptPayload<T = unknown>(
  payload: EncryptedPayload,
  jwt: string,
): Promise<T> {
  const raw = Uint8Array.from(atob(payload.v), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const body = raw.slice(12, raw.length - 16);
  const tag = raw.slice(raw.length - 16);

  // WebCrypto expects ciphertext || tag concatenated.
  const ciphertext = new Uint8Array(body.length + tag.length);
  ciphertext.set(body);
  ciphertext.set(tag, body.length);

  const key = await deriveKey(jwt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(textDecoder.decode(plain)) as T;
}