import express from 'express';
import { getEventState, updateEventState, addAuditLog } from '../storage.js';
import { hashKey, hashToken, generateSessionToken } from '../utils/crypto.js';
import { requireParticipant, checkRateLimit, resetRateLimit } from '../auth.js';

const router = express.Router();

/**
 * STEP 1: Participant Access / Login
 */
router.post('/access', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const rate = checkRateLimit(ip, 'participant_access', 10, 5 * 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: `Too many failed access attempts. Please wait ${rate.retryAfter} seconds.`,
    });
  }

  const { username, accessKey } = req.body;

  if (!username || !accessKey) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Both username and access key are required.',
    });
  }

  const eventState = await getEventState();
  const requiredUsername = eventState.settings?.participantUsername || 'SparDhaM2026';

  if (username.trim().toLowerCase() !== requiredUsername.toLowerCase()) {
    await addAuditLog({
      eventType: 'PARTICIPANT_AUTH_FAILED',
      actorType: 'participant',
      status: 'failed',
      details: `Invalid username provided: "${username.slice(0, 20)}"`,
      ip,
    });
    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: `Username must be ${requiredUsername}.`,
    });
  }

  const keyHash = hashKey(accessKey);
  const teamSlot = eventState.teams.find((t) => t.keyHash === keyHash && t.keyActive);

  if (!teamSlot) {
    await addAuditLog({
      eventType: 'PARTICIPANT_AUTH_FAILED',
      actorType: 'participant',
      status: 'failed',
      details: 'Invalid or inactive access key attempted.',
      ip,
    });
    return res.status(401).json({
      success: false,
      error: 'INVALID_KEY',
      message: 'Invalid access key. Please verify your team pass code with the event coordinator.',
    });
  }

  // Enforce event lifecycle status
  if (eventState.settings?.eventStatus === 'preparation') {
    return res.status(403).json({
      success: false,
      error: 'EVENT_IN_PREPARATION',
      message: 'The event is currently in preparation mode. Team access will open once coordinators activate the hunt.',
    });
  }

  if (eventState.settings?.eventStatus === 'finished') {
    return res.status(403).json({
      success: false,
      error: 'EVENT_FINISHED',
      message: 'The hunt has concluded. Thank you for participating in SparDhaM 2026 Tech Trek!',
    });
  }

  // Issue new session token
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);

  await updateEventState((state) => {
    const slot = state.teams.find((t) => t.id === teamSlot.id);
    if (slot) {
      slot.sessionTokenHash = tokenHash;
      slot.lastActivityAt = new Date().toISOString();
      if (slot.status === 'available') {
        slot.status = 'reserved';
      }
    }
    return state;
  });

  resetRateLimit(ip, 'participant_access');

  await addAuditLog({
    eventType: 'PARTICIPANT_AUTH_SUCCESS',
    actorType: 'participant',
    teamId: teamSlot.id,
    status: 'success',
    details: `Authenticated into Slot ${teamSlot.slotNumber}${teamSlot.teamName ? ` as "${teamSlot.teamName}"` : ' (Unregistered)'}.`,
    ip,
  });

  // Set HTTP-only cookie as well for security
  res.cookie('participant_token', rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    token: rawToken,
    team: {
      id: teamSlot.id,
      slotNumber: teamSlot.slotNumber,
      teamName: teamSlot.teamName,
      status: teamSlot.status === 'available' ? 'reserved' : teamSlot.status,
      currentHintIndex: teamSlot.currentHintIndex,
      completedCheckpoints: teamSlot.completedCheckpoints || [],
    },
  });
});

/**
 * Get current authenticated participant session state
 */
router.get('/session', requireParticipant, (req, res) => {
  const { id, slotNumber, teamName, status, currentHintIndex, completedCheckpoints } = req.team;
  res.json({
    success: true,
    team: {
      id,
      slotNumber,
      teamName,
      status,
      currentHintIndex,
      completedCheckpoints: completedCheckpoints || [],
    },
  });
});

/**
 * STEP 2: Register Team Name
 */
router.post('/register', requireParticipant, async (req, res) => {
  const { teamName } = req.body;

  if (!teamName || typeof teamName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_NAME',
      message: 'Team name is required.',
    });
  }

  const cleanName = teamName.trim();

  if (cleanName.length < 3 || cleanName.length > 30) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_LENGTH',
      message: 'Team name must be between 3 and 30 characters.',
    });
  }

  // Basic regex check for clean printable characters
  if (!/^[a-zA-Z0-9\s\-_.,!&]+$/.test(cleanName)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_CHARACTERS',
      message: 'Team name contains invalid characters. Use letters, numbers, spaces, and standard punctuation.',
    });
  }

  const eventState = await getEventState();

  // Prevent team name overwrite if already registered
  if (req.team.teamName && req.team.status === 'registered') {
    return res.status(400).json({
      success: false,
      error: 'ALREADY_REGISTERED',
      message: `Your team is already registered as "${req.team.teamName}". Changes require coordinator assistance.`,
    });
  }

  // Check duplicate team name across all slots (case-insensitive)
  const isDuplicate = eventState.teams.some(
    (t) => t.id !== req.team.id && t.teamName && t.teamName.toLowerCase() === cleanName.toLowerCase()
  );

  if (isDuplicate) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_NAME',
      message: `The team name "${cleanName}" is already taken by another team. Please choose a unique name.`,
    });
  }

  await updateEventState((state) => {
    const slot = state.teams.find((t) => t.id === req.team.id);
    if (slot) {
      slot.teamName = cleanName;
      slot.status = 'registered';
      slot.registeredAt = new Date().toISOString();
      slot.lastActivityAt = new Date().toISOString();
    }
    return state;
  });

  await addAuditLog({
    eventType: 'TEAM_REGISTERED',
    actorType: 'participant',
    teamId: req.team.id,
    status: 'success',
    details: `Slot ${req.team.slotNumber} registered team name "${cleanName}".`,
  });

  res.json({
    success: true,
    teamName: cleanName,
    message: `Team "${cleanName}" registered successfully!`,
  });
});

/**
 * Helper to get an authenticated team's ordered, published hints and route info.
 * Enforces team-specific route scoping. Falls back to global hints only if no team route exists,
 * preserving existing behavior without exposing draft/other teams' hints.
 */
function getTeamOrderedHints(eventState, teamId) {
  const teamRoutes = eventState.teamRoutes || {};
  const route = teamRoutes[teamId];

  // If a team-specific route exists
  if (route) {
    if (route.status !== 'published') {
      return {
        hasRoute: true,
        routePublished: false,
        route,
        publishedHints: [],
        allHints: [],
      };
    }

    const hintMap = new Map((eventState.hints || []).map((h) => [h.id, h]));
    const routeHintIds = route.hintIds || [];

    // Filter hints belonging to this route in specified order
    const orderedTeamHints = routeHintIds
      .map((id) => hintMap.get(id))
      .filter(Boolean);

    const publishedHints = orderedTeamHints.filter((h) => h.status === 'published');

    return {
      hasRoute: true,
      routePublished: true,
      route,
      publishedHints,
      allHints: orderedTeamHints,
    };
  }

  // Fallback if no team route defined: use legacy global hints for backwards compatibility
  const globalPublished = (eventState.hints || [])
    .filter((h) => h.status === 'published' && (!h.teamId || h.teamId === teamId))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return {
    hasRoute: false,
    routePublished: true,
    route: null,
    publishedHints: globalPublished,
    allHints: eventState.hints || [],
  };
}

/**
 * STEP 4: Retrieve Current Authorized Hint for Authenticated Team
 */
router.get('/hint', requireParticipant, async (req, res) => {
  const eventState = await getEventState();
  const team = eventState.teams.find((t) => t.id === req.team.id) || req.team;
  const currentIndex = team.currentHintIndex || 0;

  const { hasRoute, routePublished, route, publishedHints } = getTeamOrderedHints(eventState, team.id);

  if (hasRoute && !routePublished) {
    return res.json({
      success: true,
      hasHints: false,
      message: 'Your team route is currently in preparation. Coordinators will publish your mission sequence shortly!',
    });
  }

  if (publishedHints.length === 0) {
    return res.json({
      success: true,
      hasHints: false,
      message: 'No clues have been published for your team yet. Check back once coordinators release your mission clues!',
    });
  }

  if (currentIndex >= publishedHints.length) {
    return res.json({
      success: true,
      hasHints: true,
      finished: true,
      totalHints: publishedHints.length,
      finalDestination: route?.finalDestination || null,
      message: route?.finalDestination
        ? `You have conquered all clues! Final Destination: ${route.finalDestination}`
        : "You've reached the final available clue! Stay sharp, think logically, and find the campus treasure!",
    });
  }

  const activeHint = publishedHints[currentIndex];

  // Check if this hint requires a checkpoint verification
  let requiresCheckpoint = false;
  let checkpointName = null;
  if (activeHint.checkpointId) {
    const cp = (eventState.checkpoints || []).find((c) => c.id === activeHint.checkpointId);
    if (cp && cp.isActive) {
      requiresCheckpoint = true;
      checkpointName = cp.name;
    }
  }

  const isCheckpointCompleted = activeHint.checkpointId
    ? (team.completedCheckpoints || []).includes(activeHint.checkpointId)
    : true;

  res.json({
    success: true,
    hasHints: true,
    finished: false,
    teamName: team.teamName || `Slot ${team.slotNumber}`,
    totalHints: publishedHints.length,
    currentHintNumber: currentIndex + 1,
    routeName: route?.routeName || null,
    finalDestination: route?.finalDestination || null,
    hint: {
      id: activeHint.id,
      title: activeHint.title,
      content: activeHint.content,
      sequenceNumber: currentIndex + 1,
      requiresCheckpoint,
      checkpointName,
      isCheckpointCompleted,
    },
    progressionMode: eventState.settings?.progressionMode || 'manual',
  });
});

/**
 * STEP 4b: Advance to the Next Hint for Authenticated Team
 */
router.post('/next-hint', requireParticipant, async (req, res) => {
  const eventState = await getEventState();
  const team = eventState.teams.find((t) => t.id === req.team.id);
  if (!team) {
    return res.status(404).json({ success: false, error: 'TEAM_NOT_FOUND' });
  }

  const { hasRoute, routePublished, route, publishedHints } = getTeamOrderedHints(eventState, team.id);

  if (hasRoute && !routePublished) {
    return res.status(403).json({
      success: false,
      error: 'ROUTE_NOT_PUBLISHED',
      message: 'Your route is not yet published by event coordinators.',
    });
  }

  const currentIndex = team.currentHintIndex || 0;

  if (currentIndex >= publishedHints.length) {
    return res.json({
      success: true,
      finished: true,
      message: "You've already viewed all available clues for your route!",
    });
  }

  const currentHint = publishedHints[currentIndex];

  // Checkpoint validation rule
  if (
    eventState.settings?.progressionMode === 'checkpoint' &&
    currentHint.checkpointId &&
    !(team.completedCheckpoints || []).includes(currentHint.checkpointId)
  ) {
    return res.status(403).json({
      success: false,
      error: 'CHECKPOINT_REQUIRED',
      message: 'You must scan or enter the checkpoint verification code before moving to the next clue!',
    });
  }

  // Advance index by 1
  const nextIndex = currentIndex + 1;

  await updateEventState((state) => {
    const slot = state.teams.find((t) => t.id === team.id);
    if (slot) {
      slot.currentHintIndex = nextIndex;
      slot.lastActivityAt = new Date().toISOString();
    }
    return state;
  });

  await addAuditLog({
    eventType: 'HINT_REQUESTED',
    actorType: 'participant',
    teamId: team.id,
    status: 'success',
    details: `Team "${team.teamName || team.id}" progressed to hint sequence #${nextIndex + 1}.`,
  });

  res.json({
    success: true,
    newHintIndex: nextIndex,
    finished: nextIndex >= publishedHints.length,
    message: nextIndex >= publishedHints.length
      ? (route?.finalDestination ? `All clues finished! Report to: ${route.finalDestination}` : "You've unlocked the final stage clue!")
      : 'Clue unlocked! Follow the lead.',
  });
});

/**
 * STEP 4c: Checkpoint Code / QR Verification Scoped to Team Route
 */
router.post('/verify-checkpoint', requireParticipant, async (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'MISSING_CODE',
      message: 'Checkpoint verification code is required.',
    });
  }

  const cleanCode = code.trim().toUpperCase();
  const eventState = await getEventState();

  // Find checkpoint by code or unique token
  const checkpoint = (eventState.checkpoints || []).find(
    (c) => c.isActive && (c.code.toUpperCase() === cleanCode || c.token === code.trim())
  );

  if (!checkpoint) {
    await addAuditLog({
      eventType: 'CHECKPOINT_VERIFICATION_FAILED',
      actorType: 'participant',
      teamId: req.team.id,
      status: 'failed',
      details: `Invalid checkpoint code submitted: "${cleanCode.slice(0, 15)}"`,
    });
    return res.status(400).json({
      success: false,
      error: 'INVALID_CODE',
      message: 'Invalid checkpoint code. Check your surroundings and make sure you found the right location.',
    });
  }

  const team = eventState.teams.find((t) => t.id === req.team.id);
  const alreadyCompleted = (team.completedCheckpoints || []).includes(checkpoint.id);

  if (alreadyCompleted) {
    return res.json({
      success: true,
      alreadyCompleted: true,
      checkpointName: checkpoint.name,
      message: `Checkpoint "${checkpoint.name}" was already verified!`,
    });
  }

  // Record completion & auto-progress hint if currently on this checkpoint's clue for this team's route
  await updateEventState((state) => {
    const slot = state.teams.find((t) => t.id === team.id);
    if (slot) {
      slot.completedCheckpoints = slot.completedCheckpoints || [];
      slot.completedCheckpoints.push(checkpoint.id);
      slot.lastActivityAt = new Date().toISOString();

      // Check if this team's current hint requires this checkpoint
      const { publishedHints } = getTeamOrderedHints(state, team.id);
      const curHint = publishedHints[slot.currentHintIndex || 0];

      if (curHint && curHint.checkpointId === checkpoint.id) {
        slot.currentHintIndex = (slot.currentHintIndex || 0) + 1;
      }
    }
    return state;
  });

  await addAuditLog({
    eventType: 'CHECKPOINT_COMPLETED',
    actorType: 'participant',
    teamId: team.id,
    status: 'success',
    details: `Team "${team.teamName || team.id}" successfully verified checkpoint "${checkpoint.name}".`,
  });

  res.json({
    success: true,
    alreadyCompleted: false,
    checkpointName: checkpoint.name,
    message: `Checkpoint "${checkpoint.name}" verified! Your progress has been updated.`,
  });
});

/**
 * Logout
 */
router.post('/logout', requireParticipant, async (req, res) => {
  await updateEventState((state) => {
    const slot = state.teams.find((t) => t.id === req.team.id);
    if (slot) {
      slot.sessionTokenHash = null;
    }
    return state;
  });

  res.clearCookie('participant_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
