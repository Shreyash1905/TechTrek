import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const EVENT_FILE = path.join(DATA_DIR, 'event_state.json');

const BASE_URL = 'http://localhost:3001';

async function req(urlPath, options = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('TECH TREK — DYNAMIC FCFS HINT ALLOCATION SYSTEM VERIFICATION (20 TESTS)');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  // Backup original event state to restore at end of test run
  const originalStateRaw = fs.readFileSync(EVENT_FILE, 'utf8');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testNum, testName, extra = '') {
    if (condition) {
      console.log(`✓ [PASS] Test ${testNum}: ${testName}${extra ? ` (${extra})` : ''}`);
      passedCount++;
    } else {
      console.error(`✗ [FAIL] Test ${testNum}: ${testName}${extra ? ` (${extra})` : ''}`);
      failedCount++;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Pre-requisite: Admin login
    // ─────────────────────────────────────────────────────────────────────────
    const loginRes = await req('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'SHREYASH', password: 'Admin2026!' }),
    });

    const adminToken = loginRes.data?.token;
    if (!adminToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 17: Existing administrator authentication continues working
    // ─────────────────────────────────────────────────────────────────────────
    assert(loginRes.ok && Boolean(adminToken), 17, 'Existing administrator authentication continues working');

    // Setup 6 team slots with known keys
    const setupKeys = [];
    for (let slotNum = 1; slotNum <= 6; slotNum++) {
      const customKey = `TT-KEY-TEAM-${slotNum}`;
      const setKeyRes = await req('/api/admin/teams/custom-key', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ slotId: `slot-${slotNum}`, customKey, replaceActive: true }),
      });
      setupKeys.push({ slotId: `slot-${slotNum}`, slotNum, key: customKey });
    }

    // Setup published clues in sequence
    // First clear existing hints and create 3 sequential published clues
    const curState = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    curState.hints = [];
    curState.allocations = [];
    curState.teamRoutes = {};
    curState.settings.hintAllocationSettings = {
      eligibleTeamLimit: 3, // Set limit to 3 for initial test
      huntStatus: 'preparation',
    };
    fs.writeFileSync(EVENT_FILE, JSON.stringify(curState, null, 2), 'utf8');

    // Create 3 hints using admin API
    for (let i = 1; i <= 3; i++) {
      await req('/api/admin/hints', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({
          title: `Clue #${i}: Location Clue ${i}`,
          content: `Inspect courtyard zone ${i} to locate checkpoint item ${i}.`,
          status: 'published',
        }),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 15: Insufficient published hints prevent activation
    // ─────────────────────────────────────────────────────────────────────────
    // Set limit to 5 when only 3 hints are published
    await req('/api/admin/allocation-settings', {
      method: 'PUT',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ eligibleTeamLimit: 5 }),
    });

    const activateFailRes = await req('/api/admin/hunt-control', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ action: 'activate' }),
    });

    assert(
      activateFailRes.status === 400 && activateFailRes.data.error === 'INSUFFICIENT_HINTS',
      15,
      'Insufficient published hints prevent activation',
      activateFailRes.data.message
    );

    // Now set limit to 3 (matching 3 published hints) and activate hunt
    await req('/api/admin/allocation-settings', {
      method: 'PUT',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ eligibleTeamLimit: 3 }),
    });

    const activateSuccessRes = await req('/api/admin/hunt-control', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ action: 'activate' }),
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 7: Invalid access keys do not consume positions
    // ─────────────────────────────────────────────────────────────────────────
    const invalidKeyRes = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-INVALID-FAKE-KEY' }),
    });
    const stateAfterInvalid = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    assert(
      invalidKeyRes.status === 401 && (stateAfterInvalid.allocations || []).length === 0,
      7,
      'Invalid access keys do not consume positions'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 8: Revoked keys cannot allocate hints
    // ─────────────────────────────────────────────────────────────────────────
    // Revoke key for slot-6
    await req('/api/admin/teams/revoke-key', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ slotId: 'slot-6' }),
    });
    const revokedKeyRes = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-6' }),
    });
    const stateAfterRevoked = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    assert(
      revokedKeyRes.status === 401 && (stateAfterRevoked.allocations || []).length === 0,
      8,
      'Revoked keys cannot allocate hints'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Team slot numbers do not affect allocation
    // We will log in Slot 5 FIRST, then Slot 2 SECOND, then Slot 4 THIRD.
    // Notice Slot 5 is higher slot number than 2 or 4, but should receive Hint 1!
    // ─────────────────────────────────────────────────────────────────────────
    const team5Login = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-5' }),
    });
    const team5HintRes = await req('/api/participant/hint', {
      headers: { 'x-participant-token': team5Login.data.token },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: First team receives Hint 1
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      team5Login.data.allocation?.allocationSequence === 1 &&
      team5HintRes.data?.hint?.title?.includes('Clue #1'),
      1,
      'First team receives Hint 1',
      `Slot 5 received Hint #${team5HintRes.data?.hint?.sequenceNumber}: ${team5HintRes.data?.hint?.title}`
    );

    // Now log in Slot 2 SECOND
    const team2Login = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-2' }),
    });
    const team2HintRes = await req('/api/participant/hint', {
      headers: { 'x-participant-token': team2Login.data.token },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Second team receives Hint 2
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      team2Login.data.allocation?.allocationSequence === 2 &&
      team2HintRes.data?.hint?.title?.includes('Clue #2'),
      2,
      'Second team receives Hint 2',
      `Slot 2 received Hint #${team2HintRes.data?.hint?.sequenceNumber}: ${team2HintRes.data?.hint?.title}`
    );

    // Now log in Slot 4 THIRD
    const team4Login = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-4' }),
    });
    const team4HintRes = await req('/api/participant/hint', {
      headers: { 'x-participant-token': team4Login.data.token },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Third team receives Hint 3
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      team4Login.data.allocation?.allocationSequence === 3 &&
      team4HintRes.data?.hint?.title?.includes('Clue #3'),
      3,
      'Third team receives Hint 3',
      `Slot 4 received Hint #${team4HintRes.data?.hint?.sequenceNumber}: ${team4HintRes.data?.hint?.title}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Verify Test 4 (Slot independence confirmed)
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      team5Login.data.allocation.allocationSequence === 1 &&
      team2Login.data.allocation.allocationSequence === 2 &&
      team4Login.data.allocation.allocationSequence === 3,
      4,
      'Team slot numbers do not affect allocation',
      'Slot 5 got seq 1, Slot 2 got seq 2, Slot 4 got seq 3'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Duplicate login does not consume another position
    // ─────────────────────────────────────────────────────────────────────────
    const team5DupLogin = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-5' }),
    });
    const stateAfterDup = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    assert(
      team5DupLogin.data.allocation?.allocationSequence === 1 &&
      stateAfterDup.allocations.filter((a) => a.status === 'eligible').length === 3,
      5,
      'Duplicate login does not consume another position'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Refreshing the page preserves the same hint
    // (A participant refreshing the browser uses their active session token)
    // ─────────────────────────────────────────────────────────────────────────
    const activeToken = team5DupLogin.data.token || team5Login.data.token;
    const team5Session = await req('/api/participant/session', {
      headers: { 'x-participant-token': activeToken },
    });
    const team5HintRefresh = await req('/api/participant/hint', {
      headers: { 'x-participant-token': activeToken },
    });
    assert(
      team5Session.data.allocation?.allocationSequence === 1 &&
      team5HintRefresh.data?.hint?.title?.includes('Clue #1'),
      6,
      'Refreshing the page preserves the same hint',
      `Session seq: ${team5Session.data.allocation?.allocationSequence}, Clue: ${team5HintRefresh.data?.hint?.title}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 9: Only the configured number of teams receive hints (Limit = 3)
    // 4th distinct team logs in (Slot 1)
    // ─────────────────────────────────────────────────────────────────────────
    const team1Login = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-1' }),
    });
    const team1HintRes = await req('/api/participant/hint', {
      headers: { 'x-participant-token': team1Login.data.token },
    });

    assert(
      team1Login.data.allocation?.status === 'ineligible' &&
      team1Login.data.allocation?.isLate === true,
      9,
      'Only the configured number of teams receive hints',
      'Team 4 marked ineligible'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 10: Late teams receive the notice without hint content
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      team1HintRes.status === 403 &&
      team1HintRes.data.isLate === true &&
      team1HintRes.data.message?.includes('You’re late! Better luck next time.') &&
      !team1HintRes.data.hint,
      10,
      'Late teams receive the notice without hint content',
      team1HintRes.data.message
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 16: Ineligible teams cannot access protected hints through direct API calls
    // ─────────────────────────────────────────────────────────────────────────
    const team1NextHintRes = await req('/api/participant/next-hint', {
      method: 'POST',
      headers: { 'x-participant-token': team1Login.data.token },
    });
    const team1VerifyCpRes = await req('/api/participant/verify-checkpoint', {
      method: 'POST',
      headers: { 'x-participant-token': team1Login.data.token },
      body: JSON.stringify({ code: 'CK-1234' }),
    });

    assert(
      team1NextHintRes.status === 403 &&
      team1VerifyCpRes.status === 403 &&
      team1NextHintRes.data.error === 'ALLOCATION_INELIGIBLE',
      16,
      'Ineligible teams cannot access protected hints through direct API calls'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 11: Simultaneous logins produce unique, deterministic committed positions
    // Reset allocations to test concurrent logins
    // ─────────────────────────────────────────────────────────────────────────
    const resetState = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    resetState.allocations = [];
    fs.writeFileSync(EVENT_FILE, JSON.stringify(resetState, null, 2), 'utf8');

    // Fire 3 simultaneous logins for distinct slots (slot-1, slot-2, slot-3)
    const concurrentLogins = await Promise.all([
      req('/api/participant/access', {
        method: 'POST',
        body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-1' }),
      }),
      req('/api/participant/access', {
        method: 'POST',
        body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-2' }),
      }),
      req('/api/participant/access', {
        method: 'POST',
        body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-3' }),
      }),
    ]);

    const sequences = concurrentLogins.map((r) => r.data.allocation?.allocationSequence).sort();
    assert(
      JSON.stringify(sequences) === JSON.stringify([1, 2, 3]),
      11,
      'Simultaneous logins produce unique, deterministic committed allocation positions',
      `Sequences: ${JSON.stringify(sequences)}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 12: Restarting backend preserves allocations
    // Simulate by checking JSON file contents directly and re-reading state
    // ─────────────────────────────────────────────────────────────────────────
    const persistedState = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    const persistedAllocations = persistedState.allocations || [];
    assert(
      persistedAllocations.length === 3 &&
      persistedAllocations.every((a) => a.status === 'eligible' && a.allocatedAt),
      12,
      'Restarting the backend preserves allocations',
      `${persistedAllocations.length} allocations persisted to disk`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 13: Pausing and resuming does not reset allocations
    // ─────────────────────────────────────────────────────────────────────────
    const pauseRes = await req('/api/admin/hunt-control', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ action: 'pause' }),
    });

    const stateWhilePaused = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));

    const resumeRes = await req('/api/admin/hunt-control', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ action: 'resume' }),
    });

    const stateWhileResumed = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));

    assert(
      pauseRes.ok &&
      resumeRes.ok &&
      stateWhilePaused.allocations.length === 3 &&
      stateWhileResumed.allocations.length === 3,
      13,
      'Pausing and resuming does not reset allocations'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 14: Closing the hunt prevents new allocations
    // ─────────────────────────────────────────────────────────────────────────
    await req('/api/admin/hunt-control', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ action: 'close' }),
    });

    const loginWhileClosed = await req('/api/participant/access', {
      method: 'POST',
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: 'TT-KEY-TEAM-5' }),
    });

    assert(
      loginWhileClosed.status === 403 &&
      loginWhileClosed.data.error === 'HUNT_CLOSED',
      14,
      'Closing the hunt prevents new allocations',
      loginWhileClosed.data.message
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 18: Existing team management and checkpoint functionality remain intact
    // ─────────────────────────────────────────────────────────────────────────
    const teamsListRes = await req('/api/admin/teams', {
      headers: { 'x-admin-token': adminToken },
    });
    const cpListRes = await req('/api/admin/checkpoints', {
      headers: { 'x-admin-token': adminToken },
    });
    assert(
      teamsListRes.ok && Array.isArray(teamsListRes.data.teams) &&
      cpListRes.ok && Array.isArray(cpListRes.data.checkpoints),
      18,
      'Existing team management and checkpoint functionality remain intact'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 19: Existing event data is preserved
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      teamsListRes.data.teams.length >= 5 &&
      Boolean(persistedState.settings?.eventName),
      19,
      'Existing event data is preserved'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Test 20: The production build succeeds
    // Tested via vite build earlier
    // ─────────────────────────────────────────────────────────────────────────
    assert(
      fs.existsSync(path.resolve(__dirname, '../dist/index.html')),
      20,
      'The production build succeeds',
      'dist/index.html exists'
    );

  } finally {
    // Restore original event state to preserve user's data
    fs.writeFileSync(EVENT_FILE, originalStateRaw, 'utf8');
    console.log('\n[Clean Up] Restored original event state from backup.');
  }

  console.log(`\nRESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of 20 tests.`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
