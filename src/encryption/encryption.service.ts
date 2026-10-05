import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createHmac, randomBytes } from 'crypto';

/** Constant salt for HMAC-SHA256 key derivation. Visible in the bundle — intentionally. */
const KDF_SALT = ':medpark-response-enc-v1';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  /** key = HMAC-SHA256( KDF_SALT, jwt_token ) — 32 bytes, changes per session */
  private deriveKey(jwt: string): Buffer {
    return createHmac('sha256', KDF_SALT).update(jwt).digest();
  }

  /** Wire format: base64( IV[12] || ciphertext || authTag[16] ) */
  encrypt(plaintext: string, jwt: string): string {
    const key    = this.deriveKey(jwt);
    const iv     = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const part1 = cipher.update(plaintext, 'utf8');
    const part2 = cipher.final();
    const tag   = cipher.getAuthTag();

    const out = Buffer.allocUnsafe(12 + part1.length + part2.length + 16);
    iv.copy(out, 0);
    part1.copy(out, 12);
    part2.copy(out, 12 + part1.length);
    tag.copy(out, 12 + part1.length + part2.length);

    return out.toString('base64');
  }
}
