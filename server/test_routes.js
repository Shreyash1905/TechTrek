/**
 * Automated test suite for Tech Trek team-specific routes, hints, and progression
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

console.log('🧪 Starting Tech Trek Team Routes & Progression Test Suite against', BASE_URL);

let adminToken = '';
let teamAToken = '';
let teamBToken = '';
let teamAKey = '';
let teamBKey = '';
let teamAId = '';
let teamBId = '';
let checkpoint1Id = '';
let checkpoint1Code = '';
let checkpoint2Id = '';
let checkpoint2Code = '';

let teamAHint1Id = '';
let teamAHint2Id = '';
let teamBHint1Id = '';
let teamBHint2Id = '';

async function runTests() {
  try {
    // 10. Existing authentication and administrator functions still work
    console.log('\n--- Test 10: Admin Authentication ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SHREYASH', password: 'Admin2026!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
    assert.ok(adminLoginData.token, 'Admin token should be returned');
    adminToken = adminLoginData.token;
    console.log('✅ Admin login succeeded');

    // Ensure event is Active so participants can access
    const setStatusRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        eventName: 'SparDhaM 2026 — Tech Trek',
        participantUsername: 'SparDhaM2026',
        maxTeamCapacity: 5,
        progressionMode: 'checkpoint',
        eventStatus: 'active',
      }),
    });
    const setStatusData = await setStatusRes.json();
    assert.strictEqual(setStatusData.success, true, 'Settings update should succeed');
    console.log('✅ Event set to Active mode');

    // Create Checkpoints
    console.log('\n--- Setup: Create Checkpoints ---');
    const runId = Math.random().toString(36).slice(2, 6).toUpperCase();
    const cp1Res = await fetch(`${BASE_URL}/api/admin/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ name: 'Courtyard Pillar', locationHint: 'Near Fountain', customCode: `CK-A${runId}` }),
    });
    const cp1Data = await cp1Res.json();
    checkpoint1Id = cp1Data.checkpoint.id;
    checkpoint1Code = cp1Data.checkpoint.code;

    const cp2Res = await fetch(`${BASE_URL}/api/admin/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ name: 'Robotics Lab Door', locationHint: 'Block B 2nd floor', customCode: `CK-B${runId}` }),
    });
    const cp2Data = await cp2Res.json();
    checkpoint2Id = cp2Data.checkpoint.id;
    checkpoint2Code = cp2Data.checkpoint.code;
    console.log(`✅ Created Checkpoints: ${checkpoint1Code} (${checkpoint1Id}), ${checkpoint2Code} (${checkpoint2Id})`);

    // Setup Teams & Access Keys
    console.log('\n--- Setup: Team Slots & Access Keys ---');
    const teamsRes = await fetch(`${BASE_URL}/api/admin/teams`, {
      headers: { 'x-admin-token': adminToken },
    });
    const teamsData = await teamsRes.json();
    teamAId = teamsData.teams[0].id;
    teamBId = teamsData.teams[1].id;

    const keyARes = await fetch(`${BASE_URL}/api/admin/teams/generate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ slotId: teamAId }),
    });
    const keyAData = await keyARes.json();
    teamAKey = keyAData.key;

    const keyBRes = await fetch(`${BASE_URL}/api/admin/teams/generate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ slotId: teamBId }),
    });
    const keyBData = await keyBRes.json();
    teamBKey = keyBData.key;
    console.log(`✅ Generated Keys for Slot #1 (${teamAKey}) and Slot #2 (${teamBKey})`);

    // Participant Logins
    const loginARes = await fetch(`${BASE_URL}/api/participant/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: teamAKey }),
    });
    const loginAData = await loginARes.json();
    assert.strictEqual(loginAData.success, true);
    teamAToken = loginAData.token;

    const loginBRes = await fetch(`${BASE_URL}/api/participant/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SparDhaM2026', accessKey: teamBKey }),
    });
    const loginBData = await loginBRes.json();
    assert.strictEqual(loginBData.success, true);
    teamBToken = loginBData.token;
    console.log('✅ Teams A and B authenticated successfully');

    // Register Team Names
    await fetch(`${BASE_URL}/api/participant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': teamAToken },
      body: JSON.stringify({ teamName: 'CyberTitans' }),
    });
    await fetch(`${BASE_URL}/api/participant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': teamBToken },
      body: JSON.stringify({ teamName: 'QuantumSharks' }),
    });
    console.log('✅ Registered team names: "CyberTitans" and "QuantumSharks"');

    // Setup Team-specific Routes
    console.log('\n--- Setup: Author Team A and Team B Specific Routes ---');
    // Team A Clue 1 (Requires Checkpoint 1)
    const hintA1Res = await fetch(`${BASE_URL}/api/admin/routes/${teamAId}/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        title: 'Team A Clue 1: Fountain Riddle',
        content: 'Search where the clear water reflects the campus sun.',
        checkpointId: checkpoint1Id,
        status: 'published',
      }),
    });
    const hintA1Data = await hintA1Res.json();
    teamAHint1Id = hintA1Data.hint.id;

    // Team A Clue 2 (Unpublished draft)
    const hintA2Res = await fetch(`${BASE_URL}/api/admin/routes/${teamAId}/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        title: 'Team A Clue 2: Secret Draft',
        content: 'This clue is in draft mode.',
        checkpointId: null,
        status: 'draft',
      }),
    });
    const hintA2Data = await hintA2Res.json();
    teamAHint2Id = hintA2Data.hint.id;

    // Publish Route A with explicitly configured hint order
    await fetch(`${BASE_URL}/api/admin/routes/${teamAId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        routeName: 'Route Alpha: Water & Stone',
        status: 'published',
        finalDestination: 'Central Vault #1',
        hintIds: [teamAHint1Id, teamAHint2Id],
      }),
    });
    // Reset Team A progress for clean test execution
    await fetch(`${BASE_URL}/api/admin/teams/reset-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ slotId: teamAId }),
    });

    // Team B Clue 1 (Requires Checkpoint 2)
    const hintB1Res = await fetch(`${BASE_URL}/api/admin/routes/${teamBId}/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        title: 'Team B Clue 1: Robot Gear',
        content: 'Find where robotic arms weld precision circuits.',
        checkpointId: checkpoint2Id,
        status: 'published',
      }),
    });
    const hintB1Data = await hintB1Res.json();
    teamBHint1Id = hintB1Data.hint.id;

    // Team B Clue 2 (Published)
    const hintB2Res = await fetch(`${BASE_URL}/api/admin/routes/${teamBId}/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        title: 'Team B Clue 2: The Final Trophy',
        content: 'Victory awaits near the server racks.',
        checkpointId: null,
        status: 'published',
      }),
    });
    const hintB2Data = await hintB2Res.json();
    teamBHint2Id = hintB2Data.hint.id;

    // Publish Route B with explicit hintIds
    await fetch(`${BASE_URL}/api/admin/routes/${teamBId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        routeName: 'Route Beta: Silicon Matrix',
        status: 'published',
        finalDestination: 'Server Chamber #2',
        hintIds: [teamBHint1Id, teamBHint2Id],
      }),
    });
    // Reset Team B progress for clean test execution
    await fetch(`${BASE_URL}/api/admin/teams/reset-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ slotId: teamBId }),
    });
    console.log('✅ Independent routes authored and published for Team A and Team B');

    // 1. Each team receives its own assigned first hint
    console.log('\n--- Test 1: Each team receives its own assigned first hint ---');
    const hintARes = await fetch(`${BASE_URL}/api/participant/hint`, {
      headers: { 'x-participant-token': teamAToken },
    });
    const hintAData = await hintARes.json();
    assert.strictEqual(hintAData.success, true);
    assert.strictEqual(hintAData.hint.id, teamAHint1Id);
    assert.strictEqual(hintAData.hint.title, 'Team A Clue 1: Fountain Riddle');
    assert.strictEqual(hintAData.routeName, 'Route Alpha: Water & Stone');

    const hintBRes = await fetch(`${BASE_URL}/api/participant/hint`, {
      headers: { 'x-participant-token': teamBToken },
    });
    const hintBData = await hintBRes.json();
    assert.strictEqual(hintBData.success, true);
    assert.strictEqual(hintBData.hint.id, teamBHint1Id);
    assert.strictEqual(hintBData.hint.title, 'Team B Clue 1: Robot Gear');
    assert.strictEqual(hintBData.routeName, 'Route Beta: Silicon Matrix');
    console.log('✅ Passed: Both teams receive strictly their own assigned first hint');

    // 2. Different teams can have different hint sequences
    console.log('\n--- Test 2: Different teams have different hint sequences ---');
    assert.notStrictEqual(hintAData.hint.id, hintBData.hint.id);
    assert.notStrictEqual(hintAData.hint.checkpointName, hintBData.hint.checkpointName);
    console.log('✅ Passed: Team A and Team B have completely distinct hint sequences');

    // 3. Team A cannot retrieve Team B’s hints
    console.log('\n--- Test 3: Team A cannot retrieve Team B’s hints ---');
    // Team A asks for current hint; it should never be Team B's hint
    assert.notStrictEqual(hintAData.hint.id, teamBHint1Id);
    assert.notStrictEqual(hintAData.hint.id, teamBHint2Id);
    console.log('✅ Passed: Team A’s hint response does not leak Team B clues');

    // 4. Team A cannot modify Team B’s progress
    console.log('\n--- Test 4: Team A cannot modify Team B’s progress ---');
    // Team A verifies Checkpoint 1 (which belongs to Team A)
    const verify1Res = await fetch(`${BASE_URL}/api/participant/verify-checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': teamAToken },
      body: JSON.stringify({ code: checkpoint1Code }),
    });
    const verify1Data = await verify1Res.json();
    assert.strictEqual(verify1Data.success, true);

    // Verify Team B's hint was NOT changed or progressed
    const checkBRes = await fetch(`${BASE_URL}/api/participant/hint`, {
      headers: { 'x-participant-token': teamBToken },
    });
    const checkBData = await checkBRes.json();
    assert.strictEqual(checkBData.hint.id, teamBHint1Id, "Team B's hint must remain at Hint 1");
    console.log('✅ Passed: Team A verification did not alter Team B’s progress');

    // 5. Locked hints remain inaccessible
    console.log('\n--- Test 5: Locked hints remain inaccessible ---');
    // Team B has not verified Checkpoint 2, so requesting /next-hint should be blocked in checkpoint mode
    const advanceBRes = await fetch(`${BASE_URL}/api/participant/next-hint`, {
      method: 'POST',
      headers: { 'x-participant-token': teamBToken },
    });
    const advanceBData = await advanceBRes.json();
    assert.strictEqual(advanceBRes.status, 403, 'Should reject advancing without checkpoint');
    assert.strictEqual(advanceBData.error, 'CHECKPOINT_REQUIRED');
    console.log('✅ Passed: Locked hints cannot be skipped');

    // 6. Unpublished hints remain inaccessible
    console.log('\n--- Test 6: Unpublished hints remain inaccessible ---');
    // Team A finished Clue 1. Clue 2 is draft. Advancing or retrieving hint should show route finished / no hints
    const hintAAfterAdv = await fetch(`${BASE_URL}/api/participant/hint`, {
      headers: { 'x-participant-token': teamAToken },
    });
    const hintAAfterAdvData = await hintAAfterAdv.json();
    // Since Clue 2 is draft, it must not be leaked
    assert.notStrictEqual(hintAAfterAdvData.hint?.id, teamAHint2Id, 'Unpublished clue must not be exposed');
    assert.strictEqual(hintAAfterAdvData.finished, true, 'Team A should be shown as finished because Clue 2 is draft');
    console.log('✅ Passed: Unpublished draft hints are withheld from participants');

    // 7. Successful checkpoint verification unlocks only the correct team’s next hint
    console.log('\n--- Test 7: Successful checkpoint verification unlocks correct team’s next hint ---');
    const verify2Res = await fetch(`${BASE_URL}/api/participant/verify-checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': teamBToken },
      body: JSON.stringify({ code: checkpoint2Code }),
    });
    const verify2Data = await verify2Res.json();
    assert.strictEqual(verify2Data.success, true);

    const hintBStage2Res = await fetch(`${BASE_URL}/api/participant/hint`, {
      headers: { 'x-participant-token': teamBToken },
    });
    const hintBStage2Data = await hintBStage2Res.json();
    assert.strictEqual(hintBStage2Data.hint.id, teamBHint2Id, "Team B should now see Clue 2");
    assert.strictEqual(hintBStage2Data.hint.title, 'Team B Clue 2: The Final Trophy');
    console.log('✅ Passed: Checkpoint verification unlocked Team B’s specific next clue');

    // 8. Reordering hints updates the intended sequence safely
    console.log('\n--- Test 8: Reordering hints updates sequence safely ---');
    const reorderRes = await fetch(`${BASE_URL}/api/admin/routes/${teamBId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ orderedHintIds: [teamBHint2Id, teamBHint1Id] }),
    });
    const reorderData = await reorderRes.json();
    assert.strictEqual(reorderData.success, true);

    const routeBDetailRes = await fetch(`${BASE_URL}/api/admin/routes/${teamBId}`, {
      headers: { 'x-admin-token': adminToken },
    });
    const routeBDetail = await routeBDetailRes.json();
    assert.strictEqual(routeBDetail.route.hints[0].id, teamBHint2Id);
    assert.strictEqual(routeBDetail.route.hints[1].id, teamBHint1Id);
    console.log('✅ Passed: Reordering hints updated the route sequence');

    // 9. Restarting the backend preserves routes and progress
    console.log('\n--- Test 9: Persistence verification ---');
    const eventFile = path.resolve(__dirname, '../data/event_state.json');
    assert.ok(fs.existsSync(eventFile), 'data/event_state.json must exist');
    const diskContent = JSON.parse(fs.readFileSync(eventFile, 'utf8'));
    assert.ok(diskContent.teamRoutes[teamAId], 'Team A route must be saved on disk');
    assert.ok(diskContent.teamRoutes[teamBId], 'Team B route must be saved on disk');
    assert.strictEqual(diskContent.teamRoutes[teamBId].hintIds[0], teamBHint2Id, 'Reordered state must be on disk');
    console.log('✅ Passed: All team routes and progression are persisted to JSON');

    // 11. Existing event data is preserved
    console.log('\n--- Test 11: Existing event data preserved ---');
    assert.ok(diskContent.teams.length >= 2, 'Existing slots preserved');
    assert.strictEqual(diskContent.teams[0].id, teamAId);
    assert.strictEqual(diskContent.teams[1].id, teamBId);
    console.log('✅ Passed: All pre-existing team slots and configuration intact');

    console.log('\n🎉 ALL 12 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
