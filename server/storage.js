import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, hashKey, generateAccessKey } from './utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const ADMIN_FILE = path.join(DATA_DIR, 'admin_auth.json');
const EVENT_FILE = path.join(DATA_DIR, 'event_state.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');

// In-memory write queue to serialize all disk writes and avoid race conditions
let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn).catch((err) => {
    console.error('[Storage Error in write queue]:', err);
    throw err;
  });
  return writeQueue;
}

/**
 * Atomically writes data to a JSON file using a temp file + rename
 */
async function writeJsonAtomic(filePath, data) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tempPath, content, 'utf8');
  await fs.promises.rename(tempPath, filePath);
}

/**
 * Reads and parses a JSON file safely
 */
async function readJsonSafe(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    if (!content.trim()) return defaultValue;
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[Storage Warning] Failed to read ${filePath}: ${err.message}. Using default.`);
    return defaultValue;
  }
}

/**
 * Initialize storage files safely on startup without overwriting existing data
 */
export async function initStorage() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  // 1. Initialize admin_auth.json if not present
  if (!fs.existsSync(ADMIN_FILE)) {
    const defaultUsername = process.env.ADMIN_DEFAULT_USERNAME || 'SHREYASH';
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || '1905';
    const passwordHash = await hashPassword(defaultPassword);

    const initialAdmin = {
      username: defaultUsername,
      passwordHash,
      mustChangePassword: true, // Mandatory password change before operations
      sessions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(ADMIN_FILE, initialAdmin);
    console.log('[Storage] Initialized admin_auth.json with temporary bootstrap credentials.');
  }

  // 2. Initialize event_state.json if not present
  if (!fs.existsSync(EVENT_FILE)) {
    const initialSlots = Array.from({ length: 5 }, (_, i) => ({
      id: `slot-${i + 1}`,
      slotNumber: i + 1,
      teamName: null,
      keyHash: null,
      keyActive: false,
      status: 'available', // available, reserved, registered
      currentHintIndex: 0,
      completedCheckpoints: [],
      registeredAt: null,
      lastActivityAt: null,
      sessionTokenHash: null,
    }));

    const initialEventState = {
      settings: {
        eventName: 'SparDhaM 2026 — Tech Trek',
        participantUsername: 'SparDhaM2026',
        maxTeamCapacity: 5,
        progressionMode: 'manual', // 'manual' (click for next hint) or 'checkpoint' (scan/enter code)
        eventStatus: 'preparation', // 'preparation', 'active', 'finished'
      },
      teams: initialSlots,
      hints: [],
      checkpoints: [],
      teamRoutes: {}, // slotId -> { teamId, routeName, status: 'published'|'draft', finalDestination: '', hintIds: [], checkpointIds: [], createdAt, updatedAt }
      updatedAt: new Date().toISOString(),
    };

    await writeJsonAtomic(EVENT_FILE, initialEventState);
    console.log('[Storage] Initialized event_state.json with 5 default available team slots in preparation mode.');
  }

  // 3. Initialize audit_logs.json if not present
  if (!fs.existsSync(AUDIT_FILE)) {
    await writeJsonAtomic(AUDIT_FILE, []);
    console.log('[Storage] Initialized audit_logs.json.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Auth Storage Accessors
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminData() {
  return await readJsonSafe(ADMIN_FILE, {
    username: 'SHREYASH',
    passwordHash: '',
    mustChangePassword: true,
    sessions: {},
  });
}

export async function updateAdminData(updaterFn) {
  return enqueueWrite(async () => {
    const current = await getAdminData();
    const updated = await updaterFn(current);
    updated.updatedAt = new Date().toISOString();
    await writeJsonAtomic(ADMIN_FILE, updated);
    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event State Storage Accessors
// ─────────────────────────────────────────────────────────────────────────────

export async function getEventState() {
  const state = await readJsonSafe(EVENT_FILE, {
    settings: {
      eventName: 'SparDhaM 2026 — Tech Trek',
      participantUsername: 'SparDhaM2026',
      maxTeamCapacity: 5,
      progressionMode: 'manual',
      eventStatus: 'preparation',
    },
    teams: [],
    hints: [],
    checkpoints: [],
    teamRoutes: {},
  });

  if (!state.teamRoutes) {
    state.teamRoutes = {};
  }

  return state;
}

export async function updateEventState(updaterFn) {
  return enqueueWrite(async () => {
    const current = await getEventState();
    const updated = await updaterFn(current);
    updated.updatedAt = new Date().toISOString();
    await writeJsonAtomic(EVENT_FILE, updated);
    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Storage Accessors
// ─────────────────────────────────────────────────────────────────────────────

export async function getAuditLogs() {
  return await readJsonSafe(AUDIT_FILE, []);
}

export async function addAuditLog(entry) {
  return enqueueWrite(async () => {
    const logs = await getAuditLogs();
    const newEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.push(newEntry);
    // Keep up to 2000 log records in file to avoid unbounded file size
    if (logs.length > 2000) {
      logs.splice(0, logs.length - 2000);
    }
    await writeJsonAtomic(AUDIT_FILE, logs);
    return newEntry;
  });
}
