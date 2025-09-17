import { createHash } from 'crypto';

export function sha256hex(buf: Buffer | Uint8Array): string {
    const h = createHash('sha256');
    h.update(buf);
    return h.digest('hex');
}
