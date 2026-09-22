import crypto from 'crypto';

/**
 * Generates a cryptographically secure, unpredictable access code.
 * Uses Node.js crypto.randomBytes() (NO Math.random()).
 * Example output: DCA-7K4P9X
 */
export function generateSecureAccessCode(prefix: string = 'DCA'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, O, 1, I)
  const bytes = crypto.randomBytes(6);
  let code = '';

  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }

  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) || 'QUIZ';
  return `${cleanPrefix}-${code}`;
}

export function normalizeAccessCode(inputCode: string): string {
  if (!inputCode) return '';
  return inputCode.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
}
