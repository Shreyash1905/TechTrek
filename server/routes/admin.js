import express from 'express';
import QRCode from 'qrcode';
import {
  getAdminData,
  updateAdminData,
  getEventState,
  updateEventState,
  getAuditLogs,
  addAuditLog,
} from '../storage.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  generateAccessKey,
  hashKey,
  generateCheckpointCode,
} from '../utils/crypto.js';
import { requireAdmin, checkRateLimit, resetRateLimit } from '../auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Admin Authentication Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin Login
 */
router.post('/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const rate = checkRateLimit(ip, 'admin_login', 6, 5 * 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: `Too many failed login attempts. Please wait ${rate.retryAfter} seconds before trying again.`,
    });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Both username and password are required.',
    });
  }

  const adminData = await getAdminData();

  const isUserMatch = username.trim().toLowerCase() === adminData.username.toLowerCase();
  const isPassMatch = isUserMatch ? await verifyPassword(password, adminData.passwordHash) : false;

  if (!isUserMatch || !isPassMatch) {
    await addAuditLog({
      eventType: 'ADMIN_LOGIN_FAILED',
      actorType: 'administrator',
      status: 'failed',
      details: `Failed admin login attempt for user "${username.slice(0, 20)}".`,
      ip,
    });
    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid administrator credentials.',
    });
  }

  // Generate secure session token
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);

  await updateAdminData((admin) => {
    admin.sessions = admin.sessions || {};
    admin.sessions[tokenHash] = {
      createdAt: new Date().toISOString(),
      ip,
    };
    admin.lastLogin = new Date().toISOString();
    return admin;
  });

  resetRateLimit(ip, 'admin_login');

  await addAuditLog({
    eventType: 'ADMIN_LOGIN_SUCCESS',
    actorType: 'administrator',
    status: 'success',
    details: `Admin user "${adminData.username}" logged in successfully.`,
    ip,
  });

  res.cookie('admin_token', rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    token: rawToken,
    username: adminData.username,
    mustChangePassword: adminData.mustChangePassword,
    message: adminData.mustChangePassword
      ? 'Password change required before administrative operations.'
      : 'Login successful.',
  });
});

/**
 * Force / Update Admin Password
 */
router.post('/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Both current password and new password are required.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'PASSWORD_TOO_SHORT',
      message: 'New password must be at least 6 characters long.',
    });
  }

  if (newPassword === '1905') {
    return res.status(400).json({
      success: false,
      error: 'PASSWORD_INSECURE',
      message: 'You cannot reuse the default temporary bootstrap password. Please choose a strong password.',
    });
  }

  const adminData = await getAdminData();
  const isMatch = await verifyPassword(currentPassword, adminData.passwordHash);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_CURRENT_PASSWORD',
      message: 'Current password does not match.',
    });
  }

  const newHash = await hashPassword(newPassword);

  await updateAdminData((admin) => {
    admin.passwordHash = newHash;
    admin.mustChangePassword = false;
    return admin;
  });

  await addAuditLog({
    eventType: 'ADMIN_PASSWORD_CHANGED',
    actorType: 'administrator',
    status: 'success',
    details: 'Administrator password was changed successfully.',
  });

  res.json({
    success: true,
    message: 'Administrator password updated successfully. All administrative features are now enabled.',
  });
});

/**
 * Get current admin session info
 */
router.get('/me', requireAdmin, async (req, res) => {
  const adminData = await getAdminData();
  res.json({
    success: true,
    username: adminData.username,
    mustChangePassword: adminData.mustChangePassword,
    lastLogin: adminData.lastLogin,
  });
});

/**
 * Admin Logout
 */
router.post('/logout', requireAdmin, async (req, res) => {
  await updateAdminData((admin) => {
    if (admin.sessions && req.admin.tokenHash) {
      delete admin.sessions[req.admin.tokenHash];
    }
    return admin;
  });

  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Overview & Metrics
// ─────────────────────────────────────────────────────────────────────────────

router.get('/overview', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  const logs = await getAuditLogs();

  const teams = eventState.teams || [];
  const hints = eventState.hints || [];
  const checkpoints = eventState.checkpoints || [];

  const totalSlots = teams.length;
  const registeredTeams = teams.filter((t) => t.status === 'registered').length;
  const reservedSlots = teams.filter((t) => t.status === 'reserved').length;
  const availableSlots = teams.filter((t) => t.status === 'available').length;
  const keysIssued = teams.filter((t) => t.keyHash && t.keyActive).length;

  const publishedHints = hints.filter((h) => h.status === 'published').length;
  const totalCompletedCheckpoints = teams.reduce(
    (acc, t) => acc + (t.completedCheckpoints ? t.completedCheckpoints.length : 0),
    0
  );

  const recentActivity = [...logs].reverse().slice(0, 10);

  res.json({
    success: true,
    metrics: {
      eventName: eventState.settings?.eventName || 'SparDhaM 2026 — Tech Trek',
      totalSlots,
      maxTeamCapacity: eventState.settings?.maxTeamCapacity || 5,
      occupiedSlots: registeredTeams + reservedSlots,
      allocatedTeams: registeredTeams + reservedSlots,
      registeredTeams,
      availableSlots,
      keysIssued,
      totalHints: hints.length,
      publishedHints,
      totalCheckpoints: checkpoints.length,
      totalCompletedCheckpoints,
      progressionMode: eventState.settings?.progressionMode || 'manual',
      eventStatus: eventState.settings?.eventStatus || 'preparation',
    },
    teams: teams.map((t) => ({
      id: t.id,
      slotNumber: t.slotNumber,
      teamName: t.teamName,
      status: t.status,
      hasKey: Boolean(t.keyHash),
      keyActive: Boolean(t.keyActive),
      currentHintIndex: t.currentHintIndex || 0,
      completedCheckpointsCount: (t.completedCheckpoints || []).length,
      lastActivityAt: t.lastActivityAt,
    })),
    recentActivity,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Team & Access Key Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all team slots
 */
router.get('/teams', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  const sanitized = eventState.teams.map((t) => ({
    id: t.id,
    slotNumber: t.slotNumber,
    teamName: t.teamName,
    hasKey: Boolean(t.keyHash),
    keyActive: Boolean(t.keyActive),
    status: t.status,
    currentHintIndex: t.currentHintIndex || 0,
    completedCheckpoints: t.completedCheckpoints || [],
    registeredAt: t.registeredAt,
    lastActivityAt: t.lastActivityAt,
  }));

  res.json({
    success: true,
    teams: sanitized,
    maxCapacity: eventState.settings?.maxTeamCapacity || 5,
  });
});

/**
 * Add a new team slot up to max capacity
 */
router.post('/teams/create-slot', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  const maxCapacity = eventState.settings?.maxTeamCapacity || 5;

  if (eventState.teams.length >= maxCapacity) {
    return res.status(400).json({
      success: false,
      error: 'MAX_CAPACITY_REACHED',
      message: `Cannot create slot. Maximum configured capacity of ${maxCapacity} teams reached.`,
    });
  }

  const nextNumber = eventState.teams.length + 1;
  const newSlot = {
    id: `slot-${nextNumber}`,
    slotNumber: nextNumber,
    teamName: null,
    keyHash: null,
    keyActive: false,
    status: 'available',
    currentHintIndex: 0,
    completedCheckpoints: [],
    registeredAt: null,
    lastActivityAt: null,
    sessionTokenHash: null,
  };

  await updateEventState((state) => {
    state.teams.push(newSlot);
    return state;
  });

  await addAuditLog({
    eventType: 'TEAM_SLOT_CREATED',
    actorType: 'administrator',
    status: 'success',
    details: `Created team Slot #${nextNumber}.`,
  });

  res.json({ success: true, slot: newSlot });
});

/**
 * Generate a new access key for a slot (returned ONLY once)
 */
router.post('/teams/generate-key', requireAdmin, async (req, res) => {
  const { slotId } = req.body;

  if (!slotId) {
    return res.status(400).json({ success: false, error: 'MISSING_SLOT_ID' });
  }

  const eventState = await getEventState();
  const slot = eventState.teams.find((t) => t.id === slotId);

  if (!slot) {
    return res.status(404).json({ success: false, error: 'SLOT_NOT_FOUND', message: 'Team slot not found.' });
  }

  const rawKey = generateAccessKey();
  const keyHash = hashKey(rawKey);

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.keyHash = keyHash;
      s.keyActive = true;
    }
    return state;
  });

  await addAuditLog({
    eventType: 'ACCESS_KEY_GENERATED',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Issued fresh access key for Slot #${slot.slotNumber}.`,
  });

  // Return key to administrator once
  res.json({
    success: true,
    key: rawKey,
    slotNumber: slot.slotNumber,
    message: 'Access key generated. Copy and provide this key to the team coordinator. It will not be shown again.',
  });
});

/**
 * Assign a custom access key to a team slot
 */
router.post('/teams/custom-key', requireAdmin, async (req, res) => {
  const { slotId, customKey, replaceActive } = req.body;

  if (!slotId) {
    return res.status(400).json({ success: false, error: 'MISSING_SLOT_ID', message: 'Team slot ID is required.' });
  }

  if (!customKey || typeof customKey !== 'string') {
    return res.status(400).json({ success: false, error: 'INVALID_KEY', message: 'Access key is required.' });
  }

  const cleanKey = customKey.trim();

  // Validate length
  if (cleanKey.length < 4 || cleanKey.length > 32) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_LENGTH',
      message: 'Access key must be between 4 and 32 characters long.',
    });
  }

  // Validate characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_\-]+$/.test(cleanKey)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_CHARACTERS',
      message: 'Access key may only contain letters, numbers, hyphens (-), and underscores (_).',
    });
  }

  const eventState = await getEventState();
  const slot = eventState.teams.find((t) => t.id === slotId);

  if (!slot) {
    return res.status(404).json({ success: false, error: 'SLOT_NOT_FOUND', message: 'Team slot not found.' });
  }

  // Prevent silent overwrite of an active key unless explicitly requested
  if (slot.keyHash && slot.keyActive && !replaceActive) {
    return res.status(409).json({
      success: false,
      error: 'ACTIVE_KEY_EXISTS',
      message: `Slot #${slot.slotNumber} already has an active access key. Please revoke or confirm replacement explicitly.`,
    });
  }

  const keyHash = hashKey(cleanKey);

  // Check duplicate across all team slots (including revoked keys)
  const isDuplicate = eventState.teams.some(
    (t) => t.id !== slotId && t.keyHash && t.keyHash === keyHash
  );

  if (isDuplicate) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_KEY',
      message: 'This access key is already assigned to another team slot. Please choose a unique key.',
    });
  }

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.keyHash = keyHash;
      s.keyActive = true;
      // Invalidate existing participant session
      s.sessionTokenHash = null;
      if (s.status === 'available') {
        s.status = 'reserved';
      }
    }
    return state;
  });

  await addAuditLog({
    eventType: slot.keyHash ? 'ACCESS_KEY_REPLACED' : 'ACCESS_KEY_CUSTOM_ASSIGNED',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `${slot.keyHash ? 'Replaced key with custom key for' : 'Assigned custom access key to'} Slot #${slot.slotNumber}.`,
  });

  res.json({
    success: true,
    slotNumber: slot.slotNumber,
    message: 'Access key saved successfully. For security, the saved key cannot be displayed again. If you lose it, revoke it and issue a replacement.',
  });
});

/**
 * Allocate or create a team slot with optional team name and key
 */
router.post('/teams/allocate', requireAdmin, async (req, res) => {
  const { slotId, teamName, keyOption, customKey } = req.body;
  const eventState = await getEventState();
  const maxCapacity = eventState.settings?.maxTeamCapacity || 5;

  let targetSlot = null;

  if (slotId) {
    targetSlot = eventState.teams.find((t) => t.id === slotId);
    if (!targetSlot) {
      return res.status(404).json({ success: false, error: 'SLOT_NOT_FOUND', message: 'Selected team slot not found.' });
    }
  } else {
    // Find first available slot
    targetSlot = eventState.teams.find((t) => t.status === 'available');
    // If no available slot exists and under capacity, create one
    if (!targetSlot) {
      if (eventState.teams.length >= maxCapacity) {
        return res.status(400).json({
          success: false,
          error: 'MAX_CAPACITY_REACHED',
          message: `Cannot allocate team. Maximum capacity of ${maxCapacity} teams reached.`,
        });
      }
      const nextNum = eventState.teams.length + 1;
      targetSlot = {
        id: `slot-${nextNum}`,
        slotNumber: nextNum,
        teamName: null,
        keyHash: null,
        keyActive: false,
        status: 'available',
        currentHintIndex: 0,
        completedCheckpoints: [],
        registeredAt: null,
        lastActivityAt: null,
        sessionTokenHash: null,
      };
      eventState.teams.push(targetSlot);
    }
  }

  // Validate teamName if provided
  let cleanName = null;
  if (teamName && typeof teamName === 'string' && teamName.trim()) {
    cleanName = teamName.trim();
    if (cleanName.length < 3 || cleanName.length > 30) {
      return res.status(400).json({ success: false, error: 'INVALID_LENGTH', message: 'Team name must be between 3 and 30 characters.' });
    }
    const isDupName = eventState.teams.some(
      (t) => t.id !== targetSlot.id && t.teamName && t.teamName.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDupName) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_NAME', message: 'A team with this name already exists.' });
    }
  }

  // Key handling
  let rawGeneratedKey = null;
  let keyHashToStore = null;

  if (keyOption === 'generate') {
    rawGeneratedKey = generateAccessKey();
    keyHashToStore = hashKey(rawGeneratedKey);
  } else if (keyOption === 'custom') {
    if (!customKey || typeof customKey !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_KEY', message: 'Custom access key is required.' });
    }
    const cleanKey = customKey.trim();
    if (cleanKey.length < 4 || cleanKey.length > 32) {
      return res.status(400).json({ success: false, error: 'INVALID_LENGTH', message: 'Access key must be 4–32 characters.' });
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanKey)) {
      return res.status(400).json({ success: false, error: 'INVALID_CHARACTERS', message: 'Access key may only contain letters, numbers, hyphens, and underscores.' });
    }
    const keyHash = hashKey(cleanKey);
    const isDupKey = eventState.teams.some((t) => t.id !== targetSlot.id && t.keyHash === keyHash);
    if (isDupKey) {
      return res.status(409).json({ success: false, error: 'DUPLICATE_KEY', message: 'This key is already assigned to another slot.' });
    }
    keyHashToStore = keyHash;
  }

  await updateEventState((state) => {
    let s = state.teams.find((t) => t.id === targetSlot.id);
    if (!s) {
      s = targetSlot;
      state.teams.push(s);
    }
    if (cleanName) {
      s.teamName = cleanName;
      s.status = 'registered';
      s.registeredAt = new Date().toISOString();
    } else if (keyHashToStore) {
      s.status = 'reserved';
    }
    if (keyHashToStore) {
      s.keyHash = keyHashToStore;
      s.keyActive = true;
      s.sessionTokenHash = null;
    }
    s.lastActivityAt = new Date().toISOString();
    return state;
  });

  await addAuditLog({
    eventType: 'TEAM_ALLOCATED',
    actorType: 'administrator',
    teamId: targetSlot.id,
    status: 'success',
    details: `Allocated Slot #${targetSlot.slotNumber}${cleanName ? ` for "${cleanName}"` : ''}${keyHashToStore ? ' with access key' : ''}.`,
  });

  res.json({
    success: true,
    slotNumber: targetSlot.slotNumber,
    teamName: cleanName,
    key: rawGeneratedKey,
    message: rawGeneratedKey
      ? `Team slot allocated. Copy generated key: ${rawGeneratedKey}`
      : 'Team slot allocated successfully.',
  });
});

/**
 * Revoke an access key
 */
router.post('/teams/revoke-key', requireAdmin, async (req, res) => {
  const { slotId } = req.body;

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.keyActive = false;
      // Invalidate active session token
      s.sessionTokenHash = null;
    }
    return state;
  });

  await addAuditLog({
    eventType: 'ACCESS_KEY_REVOKED',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Revoked access key for ${slotId}.`,
  });

  res.json({ success: true, message: 'Access key has been deactivated.' });
});

/**
 * Administrative team name correction
 */
router.post('/teams/rename', requireAdmin, async (req, res) => {
  const { slotId, newTeamName } = req.body;

  if (!newTeamName || typeof newTeamName !== 'string' || newTeamName.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'INVALID_NAME', message: 'Valid team name required.' });
  }

  const cleanName = newTeamName.trim();
  const eventState = await getEventState();

  const isDuplicate = eventState.teams.some(
    (t) => t.id !== slotId && t.teamName && t.teamName.toLowerCase() === cleanName.toLowerCase()
  );
  if (isDuplicate) {
    return res.status(409).json({ success: false, error: 'DUPLICATE_NAME', message: 'A team with this name already exists.' });
  }

  let oldName = '';
  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      oldName = s.teamName || 'Unregistered';
      s.teamName = cleanName;
      if (s.status === 'available' || s.status === 'reserved') {
        s.status = 'registered';
      }
    }
    return state;
  });

  await addAuditLog({
    eventType: 'ADMIN_TEAM_NAME_CORRECTED',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Renamed team from "${oldName}" to "${cleanName}".`,
  });

  res.json({ success: true, message: `Team name updated to "${cleanName}".` });
});

/**
 * Administrative progress reset
 */
router.post('/teams/reset-progress', requireAdmin, async (req, res) => {
  const { slotId } = req.body;

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.currentHintIndex = 0;
      s.completedCheckpoints = [];
      s.lastActivityAt = new Date().toISOString();
    }
    return state;
  });

  await addAuditLog({
    eventType: 'TEAM_PROGRESS_RESET',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Reset hint & checkpoint progress for team slot ${slotId}.`,
  });

  res.json({ success: true, message: 'Team progress reset to Checkpoint 1.' });
});

/**
 * Administrative team deletion (resets slot to available, invalidates keys & sessions)
 */
router.post('/teams/delete', requireAdmin, async (req, res) => {
  const { slotId } = req.body;

  if (!slotId) {
    return res.status(400).json({ success: false, error: 'MISSING_SLOT_ID', message: 'Team slot ID is required.' });
  }

  const eventState = await getEventState();
  const slot = eventState.teams.find((t) => t.id === slotId);

  if (!slot) {
    return res.status(404).json({ success: false, error: 'SLOT_NOT_FOUND', message: 'Team slot not found.' });
  }

  const formerName = slot.teamName;
  const slotNumber = slot.slotNumber;
  const hadProgress = (slot.currentHintIndex || 0) > 0 || (slot.completedCheckpoints || []).length > 0;

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.teamName = null;
      s.keyHash = null;
      s.keyActive = false;
      s.status = 'available';
      s.currentHintIndex = 0;
      s.completedCheckpoints = [];
      s.registeredAt = null;
      s.lastActivityAt = null;
      s.sessionTokenHash = null;
    }
    return state;
  });

  await addAuditLog({
    eventType: 'TEAM_DELETED',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Deleted team allocation for Slot #${slotNumber} (former team: "${formerName || 'Unregistered'}"${hadProgress ? ', had active hunt progress' : ''}). Slot reset to available.`,
  });

  res.json({
    success: true,
    message: `Team Slot #${slotNumber} has been deleted and reset to available.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hint Management
// ─────────────────────────────────────────────────────────────────────────────

router.get('/hints', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  const hints = (eventState.hints || []).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  res.json({ success: true, hints });
});

router.post('/hints', requireAdmin, async (req, res) => {
  const { title, content, checkpointId, status } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Title and content are required.' });
  }

  const eventState = await getEventState();
  const nextSeq = (eventState.hints || []).length + 1;

  const newHint = {
    id: `hint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim(),
    content: content.trim(),
    sequenceNumber: nextSeq,
    status: status === 'published' ? 'published' : 'draft',
    checkpointId: checkpointId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateEventState((state) => {
    state.hints = state.hints || [];
    state.hints.push(newHint);
    return state;
  });

  await addAuditLog({
    eventType: 'HINT_CREATED',
    actorType: 'administrator',
    status: 'success',
    details: `Created Hint #${nextSeq} ("${newHint.title}") as ${newHint.status}.`,
  });

  res.json({ success: true, hint: newHint });
});

router.put('/hints/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, checkpointId, status } = req.body;

  let updatedHint = null;

  await updateEventState((state) => {
    const hint = (state.hints || []).find((h) => h.id === id);
    if (hint) {
      if (title) hint.title = title.trim();
      if (content) hint.content = content.trim();
      if (checkpointId !== undefined) hint.checkpointId = checkpointId || null;
      if (status) hint.status = status === 'published' ? 'published' : 'draft';
      hint.updatedAt = new Date().toISOString();
      updatedHint = hint;
    }
    return state;
  });

  if (!updatedHint) {
    return res.status(404).json({ success: false, error: 'HINT_NOT_FOUND' });
  }

  await addAuditLog({
    eventType: 'HINT_EDITED',
    actorType: 'administrator',
    status: 'success',
    details: `Updated Hint #${updatedHint.sequenceNumber} ("${updatedHint.title}").`,
  });

  res.json({ success: true, hint: updatedHint });
});

router.delete('/hints/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let deletedHint = null;

  await updateEventState((state) => {
    const idx = (state.hints || []).findIndex((h) => h.id === id);
    if (idx !== -1) {
      deletedHint = state.hints.splice(idx, 1)[0];
      // Re-index remaining sequence numbers
      state.hints.forEach((h, i) => {
        h.sequenceNumber = i + 1;
      });
    }
    return state;
  });

  if (!deletedHint) {
    return res.status(404).json({ success: false, error: 'HINT_NOT_FOUND' });
  }

  await addAuditLog({
    eventType: 'HINT_DELETED',
    actorType: 'administrator',
    status: 'success',
    details: `Deleted hint "${deletedHint.title}".`,
  });

  res.json({ success: true, message: 'Hint deleted and sequences normalized.' });
});

router.post('/hints/reorder', requireAdmin, async (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ success: false, error: 'INVALID_DATA' });
  }

  await updateEventState((state) => {
    const hintMap = new Map((state.hints || []).map((h) => [h.id, h]));
    const reordered = [];

    orderedIds.forEach((id, index) => {
      const hint = hintMap.get(id);
      if (hint) {
        hint.sequenceNumber = index + 1;
        reordered.push(hint);
        hintMap.delete(id);
      }
    });

    // Append any unmentioned hints at the end
    hintMap.forEach((hint) => {
      hint.sequenceNumber = reordered.length + 1;
      reordered.push(hint);
    });

    state.hints = reordered;
    return state;
  });

  await addAuditLog({
    eventType: 'HINT_REORDERED',
    actorType: 'administrator',
    status: 'success',
    details: 'Reordered clues sequence.',
  });

  res.json({ success: true, message: 'Hints sequence updated.' });
});

router.post('/hints/:id/publish', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let currentStatus = '';

  await updateEventState((state) => {
    const hint = (state.hints || []).find((h) => h.id === id);
    if (hint) {
      hint.status = hint.status === 'published' ? 'draft' : 'published';
      currentStatus = hint.status;
      hint.updatedAt = new Date().toISOString();
    }
    return state;
  });

  await addAuditLog({
    eventType: currentStatus === 'published' ? 'HINT_PUBLISHED' : 'HINT_UNPUBLISHED',
    actorType: 'administrator',
    status: 'success',
    details: `Hint "${id}" is now ${currentStatus}.`,
  });

  res.json({ success: true, status: currentStatus });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoints Management
// ─────────────────────────────────────────────────────────────────────────────

router.get('/checkpoints', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  const checkpoints = await Promise.all(
    (eventState.checkpoints || []).map(async (cp) => {
      let qrDataUrl = null;
      try {
        qrDataUrl = await QRCode.toDataURL(cp.code || cp.token, { width: 220, margin: 1 });
      } catch (e) {}
      return {
        ...cp,
        qrDataUrl,
      };
    })
  );
  res.json({ success: true, checkpoints });
});

router.post('/checkpoints', requireAdmin, async (req, res) => {
  const { name, locationHint, customCode } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'MISSING_NAME', message: 'Checkpoint name is required.' });
  }

  const code = (customCode && customCode.trim().toUpperCase()) || generateCheckpointCode();
  const token = `ck-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const newCheckpoint = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    locationHint: (locationHint || '').trim(),
    code,
    token,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await updateEventState((state) => {
    state.checkpoints = state.checkpoints || [];
    state.checkpoints.push(newCheckpoint);
    return state;
  });

  await addAuditLog({
    eventType: 'CHECKPOINT_CREATED',
    actorType: 'administrator',
    status: 'success',
    details: `Created Checkpoint "${newCheckpoint.name}" with code ${code}.`,
  });

  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(code, { width: 220, margin: 1 });
  } catch (e) {}

  res.json({ success: true, checkpoint: { ...newCheckpoint, qrDataUrl } });
});

router.put('/checkpoints/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, locationHint, isActive, code } = req.body;

  let updated = null;
  await updateEventState((state) => {
    const cp = (state.checkpoints || []).find((c) => c.id === id);
    if (cp) {
      if (name) cp.name = name.trim();
      if (locationHint !== undefined) cp.locationHint = locationHint.trim();
      if (isActive !== undefined) cp.isActive = Boolean(isActive);
      if (code) cp.code = code.trim().toUpperCase();
      updated = cp;
    }
    return state;
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'CHECKPOINT_NOT_FOUND' });
  }

  res.json({ success: true, checkpoint: updated });
});

router.delete('/checkpoints/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  await updateEventState((state) => {
    state.checkpoints = (state.checkpoints || []).filter((c) => c.id !== id);
    // Unlink any hints pointing to this checkpoint
    (state.hints || []).forEach((h) => {
      if (h.checkpointId === id) h.checkpointId = null;
    });
    return state;
  });

  await addAuditLog({
    eventType: 'CHECKPOINT_DELETED',
    actorType: 'administrator',
    status: 'success',
    details: `Deleted checkpoint ${id}.`,
  });

  res.json({ success: true, message: 'Checkpoint removed.' });
});

/**
 * Manual Coordinator Checkpoint Override
 */
router.post('/checkpoints/:id/override', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { slotId } = req.body;

  const eventState = await getEventState();
  const cp = (eventState.checkpoints || []).find((c) => c.id === id);
  const slot = eventState.teams.find((t) => t.id === slotId);

  if (!cp || !slot) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Checkpoint or Team slot not found.' });
  }

  await updateEventState((state) => {
    const s = state.teams.find((t) => t.id === slotId);
    if (s) {
      s.completedCheckpoints = s.completedCheckpoints || [];
      if (!s.completedCheckpoints.includes(id)) {
        s.completedCheckpoints.push(id);
      }
      s.lastActivityAt = new Date().toISOString();
    }
    return state;
  });

  await addAuditLog({
    eventType: 'COORDINATOR_CHECKPOINT_OVERRIDE',
    actorType: 'administrator',
    teamId: slotId,
    status: 'success',
    details: `Coordinator manual override: Checkpoint "${cp.name}" marked complete for ${slot.teamName || slotId}.`,
  });

  res.json({ success: true, message: `Checkpoint "${cp.name}" marked verified for ${slot.teamName || slot.id}.` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Settings
// ─────────────────────────────────────────────────────────────────────────────

router.get('/settings', requireAdmin, async (req, res) => {
  const eventState = await getEventState();
  res.json({ success: true, settings: eventState.settings });
});

router.put('/settings', requireAdmin, async (req, res) => {
  const { maxTeamCapacity, progressionMode, eventStatus, eventName } = req.body;

  await updateEventState((state) => {
    state.settings = state.settings || {};
    if (eventName) state.settings.eventName = eventName.trim();
    if (maxTeamCapacity && Number(maxTeamCapacity) >= 2 && Number(maxTeamCapacity) <= 20) {
      state.settings.maxTeamCapacity = Number(maxTeamCapacity);
    }
    if (progressionMode === 'manual' || progressionMode === 'checkpoint') {
      state.settings.progressionMode = progressionMode;
    }
    if (['preparation', 'active', 'finished'].includes(eventStatus)) {
      state.settings.eventStatus = eventStatus;
    }
    // Strict enforcement: Participant username can NEVER be changed away from SparDhaM2026
    state.settings.participantUsername = 'SparDhaM2026';
    return state;
  });

  await addAuditLog({
    eventType: 'SETTINGS_UPDATED',
    actorType: 'administrator',
    status: 'success',
    details: `Updated event settings: Status=${eventStatus || 'unchanged'}, Progression=${progressionMode || 'unchanged'}.`,
  });

  const updated = await getEventState();
  res.json({ success: true, settings: updated.settings });
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logs & Secure CSV Export
// ─────────────────────────────────────────────────────────────────────────────

router.get('/audit-logs', requireAdmin, async (req, res) => {
  const { page = 1, limit = 50, eventType, status, search } = req.query;
  const allLogs = await getAuditLogs();

  let filtered = [...allLogs].reverse();

  if (eventType) {
    filtered = filtered.filter((l) => l.eventType === eventType);
  }
  if (status) {
    filtered = filtered.filter((l) => l.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.eventType && l.eventType.toLowerCase().includes(q)) ||
        (l.teamId && l.teamId.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const startIndex = (p - 1) * l;
  const paginated = filtered.slice(startIndex, startIndex + l);

  res.json({
    success: true,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
    logs: paginated,
  });
});

/**
 * Export Audit Logs to CSV with Formula Injection Protection
 */
router.get('/audit-logs/export', requireAdmin, async (req, res) => {
  const logs = await getAuditLogs();

  // Formula injection sanitizer: Escape =, +, -, @, \t, \r
  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`; // prepend single quote to neutralize formula
    }
    return `"${str}"`;
  };

  const headers = ['Event ID', 'Timestamp', 'Event Type', 'Actor', 'Team ID', 'Status', 'Details', 'IP Address'];
  const rows = [headers.join(',')];

  logs.forEach((log) => {
    rows.push(
      [
        sanitizeCell(log.id),
        sanitizeCell(log.timestamp),
        sanitizeCell(log.eventType),
        sanitizeCell(log.actorType),
        sanitizeCell(log.teamId || '—'),
        sanitizeCell(log.status),
        sanitizeCell(log.details),
        sanitizeCell(log.ip || '—'),
      ].join(',')
    );
  });

  const csvContent = rows.join('\r\n');
  const filename = `TechTrek_AuditLogs_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

export default router;
