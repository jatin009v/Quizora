import crypto from 'crypto';

/**
 * Generates a cryptographically secure, unpredictable access code.
 * Uses crypto.randomBytes() (NO Math.random()).
 * Example output: DCA7X9P2
 */
export function generateSecureAccessCode(prefix: string = 'DCA'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, O, 1, I)
  const bytes = crypto.randomBytes(6);
  let randomStr = '';

  for (let i = 0; i < 6; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }

  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3) || 'DCA';
  return `${cleanPrefix}-${randomStr}`;
}

export function normalizeAccessCode(inputCode: string | null | undefined): string {
  if (!inputCode) return '';
  return inputCode.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
}
