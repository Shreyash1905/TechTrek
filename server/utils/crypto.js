import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random access key
 * Format: TT-XXXXXX (e.g., TT-7K9M2P) using unambiguous uppercase alphanumeric characters
 */
export function generateAccessKey() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude 0, 1, I, O to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `TT-${code}`;
}

/**
 * Hash an access key using SHA-256 for fast, deterministic server-side lookup
 */
export function hashKey(key) {
  if (!key) return '';
  const normalized = key.trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a cryptographically secure random session token
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a session token for safe storage
 */
export function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a random checkpoint verification code
 * e.g. CK-3892
 */
export function generateCheckpointCode() {
  const num = crypto.randomInt(1000, 9999);
  return `CK-${num}`;
}
