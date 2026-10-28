import { getAdminData, getEventState } from './storage.js';
import { hashToken } from './utils/crypto.js';

// Simple in-memory rate limiter per IP address
const ipRateLimitMap = new Map();

/**
 * Check and record failed attempts per IP
 */
export function checkRateLimit(ip, action = 'login', maxAttempts = 6, windowMs = 5 * 60 * 1000) {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const record = ipRateLimitMap.get(key) || { count: 0, firstAttempt: now };

  if (now - record.firstAttempt > windowMs) {
    record.count = 1;
    record.firstAttempt = now;
    ipRateLimitMap.set(key, record);
    return { allowed: true };
  }

  record.count += 1;
  ipRateLimitMap.set(key, record);

  if (record.count > maxAttempts) {
    const remainingTimeSec = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
    return {
      allowed: false,
      retryAfter: remainingTimeSec,
    };
  }

  return { allowed: true };
}

export function resetRateLimit(ip, action = 'login') {
  ipRateLimitMap.delete(`${action}:${ip}`);
}

/**
 * Middleware: Requires authenticated Administrator
 */
export async function requireAdmin(req, res, next) {
  try {
    const rawToken = req.headers['x-admin-token'] || req.cookies?.admin_token;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Administrator session token is required.',
      });
    }

    const tokenHash = hashToken(rawToken);
    const adminData = await getAdminData();

    const session = adminData.sessions?.[tokenHash];
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Invalid or expired administrator session.',
      });
    }

    // Check session expiration (12 hours)
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    if (sessionAge > 12 * 60 * 60 * 1000) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Administrator session has expired. Please log in again.',
      });
    }

    // If password change is required, only allow change-password, me, and logout
    if (adminData.mustChangePassword) {
      const allowedPaths = ['/api/admin/change-password', '/api/admin/me', '/api/admin/logout'];
      if (!allowedPaths.includes(req.originalUrl.split('?')[0])) {
        return res.status(403).json({
          success: false,
          error: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change the temporary administrator password before performing administrative actions.',
        });
      }
    }

    req.admin = {
      username: adminData.username,
      mustChangePassword: adminData.mustChangePassword,
      tokenHash,
    };
    next();
  } catch (err) {
    console.error('[Admin Auth Error]:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Authentication verification failed.' });
  }
}

/**
 * Middleware: Requires authenticated Participant Team
 */
export async function requireParticipant(req, res, next) {
  try {
    const rawToken = req.headers['x-participant-token'] || req.cookies?.participant_token;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Team authentication token is required.',
      });
    }

    const tokenHash = hashToken(rawToken);
    const eventState = await getEventState();

    const team = eventState.teams.find((t) => t.sessionTokenHash === tokenHash);
    if (!team) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Invalid or expired participant session.',
      });
    }

    req.team = team;
    next();
  } catch (err) {
    console.error('[Participant Auth Error]:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Team authentication verification failed.' });
  }
}
