#!/usr/bin/env node
/**
 * Cinq E2E Test Suite
 * Tests the complete user flow: gift → register → login → contacts → messages → ping
 * 
 * Run: node tests/e2e.mjs
 * Results logged to tests/results.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const API_BASE = process.env.API_URL || 'https://cinq-three.vercel.app/api';
const VERBOSE = process.env.VERBOSE === '1';

// Test state
const results = {
  timestamp: new Date().toISOString(),
  apiBase: API_BASE,
  tests: [],
  summary: { passed: 0, failed: 0, skipped: 0 }
};

let currentSuite = '';

// Test utilities
function log(msg, type = 'info') {
  const icons = { info: 'ℹ️', pass: '✅', fail: '❌', skip: '⏭️', warn: '⚠️' };
  console.log(`${icons[type] || '•'} ${msg}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(obj, key, message) {
  if (!(key in obj)) {
    throw new Error(`${message}: missing key "${key}" in ${JSON.stringify(obj)}`);
  }
}

async function test(name, fn) {
  const testResult = { suite: currentSuite, name, status: 'pending', duration: 0 };
  const start = Date.now();
  
  try {
    await fn();
    testResult.status = 'passed';
    testResult.duration = Date.now() - start;
    results.summary.passed++;
    log(`${name} (${testResult.duration}ms)`, 'pass');
  } catch (err) {
    testResult.status = 'failed';
    testResult.error = err.message;
    testResult.duration = Date.now() - start;
    results.summary.failed++;
    log(`${name}: ${err.message}`, 'fail');
    if (VERBOSE) console.error(err.stack);
  }
  
  results.tests.push(testResult);
  return testResult.status === 'passed';
}

function skip(name, reason) {
  results.tests.push({ suite: currentSuite, name, status: 'skipped', reason });
  results.summary.skipped++;
  log(`${name} - ${reason}`, 'skip');
}

function suite(name) {
  currentSuite = name;
  console.log(`\n━━━ ${name} ━━━`);
}

// HTTP helpers
async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  const data = await res.json().catch(() => ({}));
  
  if (VERBOSE) {
    console.log(`  → ${options.method || 'GET'} ${endpoint} → ${res.status}`);
    console.log(`    ${JSON.stringify(data).slice(0, 200)}`);
  }
  
  return { status: res.status, data, ok: res.ok };
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// ============ TEST SUITES ============

// Shared state between tests
const state = {
  giftCode: null,
  user1: { email: null, password: null, token: null, id: null },
  user2: { email: null, password: null, token: null, id: null }
};

async function runTests() {
  console.log('🧪 Cinq E2E Test Suite');
  console.log(`   API: ${API_BASE}`);
  console.log(`   Time: ${new Date().toLocaleString()}\n`);

  // Generate unique emails for this test run
  const timestamp = Date.now();
  state.user1.email = `test1_${timestamp}@e2e.test`;
  state.user1.password = 'TestPassword123!';
  state.user2.email = `test2_${timestamp}@e2e.test`;
  state.user2.password = 'TestPassword456!';

  // ============ GIFT CODES ============
  suite('Gift Codes');
  
  await test('POST /gift?action=create - creates gift code', async () => {
    const { status, data } = await api('/gift?action=create', { method: 'POST' });
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'code', 'Response');
    assert(data.code.startsWith('CINQ-'), 'Code format');
    assert(data.code.length === 14, 'Code length');
    state.giftCode = data.code;
  });

  await test('GET /gift?action=verify&code=VALID - verifies valid code', async () => {
    const { status, data } = await api(`/gift?action=verify&code=${state.giftCode}`);
    assertEqual(status, 200, 'Status code');
    assertEqual(data.valid, true, 'Valid flag');
  });

  await test('GET /gift?action=verify&code=INVALID - rejects invalid code', async () => {
    const { status, data } = await api('/gift?action=verify&code=CINQ-FAKE-CODE');
    assertEqual(status, 200, 'Status code');
    assertEqual(data.valid, false, 'Valid flag');
  });

  // ============ REGISTRATION ============
  suite('Registration');

  await test('POST /auth?action=register - missing fields returns 400', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: {}
    });
    assertEqual(status, 400, 'Status code');
  });

  await test('POST /auth?action=register - invalid email returns 400', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: { email: 'notanemail', password: 'test1234', giftCode: state.giftCode }
    });
    assertEqual(status, 400, 'Status code');
    assertEqual(data.field, 'email', 'Error field');
  });

  await test('POST /auth?action=register - short password returns 400', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'short', giftCode: state.giftCode }
    });
    assertEqual(status, 400, 'Status code');
    assertEqual(data.field, 'password', 'Error field');
  });

  await test('POST /auth?action=register - invalid gift code format returns 400', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'test1234', giftCode: 'BADCODE' }
    });
    assertEqual(status, 400, 'Status code');
    assertEqual(data.field, 'giftCode', 'Error field');
  });

  await test('POST /auth?action=register - user 1 registers successfully', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: {
        email: state.user1.email,
        password: state.user1.password,
        giftCode: state.giftCode
      }
    });
    assertEqual(status, 200, 'Status code');
    assertEqual(data.success, true, 'Success flag');
    assertContains(data, 'session', 'Response has session');
    state.user1.token = data.session.access_token;
    state.user1.id = data.user.id;
  });

  await test('GET /gift?action=verify - code is now redeemed', async () => {
    const { status, data } = await api(`/gift?action=verify&code=${state.giftCode}`);
    assertEqual(status, 200, 'Status code');
    assertEqual(data.valid, false, 'Valid flag should be false');
    assertEqual(data.reason, 'Code déjà utilisé', 'Reason');
  });

  // Create second user for contact tests
  let giftCode2 = null;
  await test('POST /gift?action=create - create second gift code', async () => {
    const { status, data } = await api('/gift?action=create', { method: 'POST' });
    assertEqual(status, 200, 'Status code');
    giftCode2 = data.code;
  });

  await test('POST /auth?action=register - user 2 registers successfully', async () => {
    const { status, data } = await api('/auth?action=register', {
      method: 'POST',
      body: {
        email: state.user2.email,
        password: state.user2.password,
        giftCode: giftCode2
      }
    });
    assertEqual(status, 200, 'Status code');
    assertEqual(data.success, true, 'Success flag');
    state.user2.token = data.session.access_token;
    state.user2.id = data.user.id;
  });

  // ============ LOGIN ============
  suite('Login');

  await test('POST /auth?action=login - wrong password returns 401', async () => {
    const { status, data } = await api('/auth?action=login', {
      method: 'POST',
      body: { email: state.user1.email, password: 'wrongpassword123' }
    });
    assertEqual(status, 401, 'Status code');
  });

  await test('POST /auth?action=login - user 1 logs in successfully', async () => {
    const { status, data } = await api('/auth?action=login', {
      method: 'POST',
      body: { email: state.user1.email, password: state.user1.password }
    });
    assertEqual(status, 200, 'Status code');
    assertEqual(data.success, true, 'Success flag');
    assertContains(data, 'session', 'Response has session');
    state.user1.token = data.session.access_token;
  });

  await test('GET /auth?action=me - returns current user', async () => {
    const { status, data } = await api('/auth?action=me', {
      ...authHeaders(state.user1.token)
    });
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'user', 'Response has user');
    assertEqual(data.user.email, state.user1.email, 'Email matches');
  });

  await test('GET /auth?action=me - no token returns 401', async () => {
    const { status } = await api('/auth?action=me');
    assertEqual(status, 401, 'Status code');
  });

  // ============ CONTACTS ============
  suite('Contacts');

  await test('GET /contacts - empty contacts list', async () => {
    const { status, data } = await api('/contacts', authHeaders(state.user1.token));
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'contacts', 'Response has contacts');
    assertEqual(data.count, 0, 'Count is 0');
    assertEqual(data.max, 5, 'Max is 5');
  });

  await test('GET /contacts?action=search - find user by email', async () => {
    const { status, data } = await api(
      `/contacts?action=search&search=${encodeURIComponent(state.user2.email)}`,
      authHeaders(state.user1.token)
    );
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'user', 'Response has user');
    assertEqual(data.user.email, state.user2.email, 'Found user email');
    assertEqual(data.alreadyContact, false, 'Not yet a contact');
  });

  await test('GET /contacts?action=search - self search returns 400', async () => {
    const { status, data } = await api(
      `/contacts?action=search&search=${encodeURIComponent(state.user1.email)}`,
      authHeaders(state.user1.token)
    );
    assertEqual(status, 400, 'Status code');
  });

  await test('POST /contacts - add user 2 as contact by email', async () => {
    const { status, data } = await api('/contacts', {
      method: 'POST',
      ...authHeaders(state.user1.token),
      body: { email: state.user2.email }
    });
    assertEqual(status, 201, 'Status code');
    assertEqual(data.success, true, 'Success flag');
  });

  await test('POST /contacts - duplicate contact returns 409', async () => {
    const { status, data } = await api('/contacts', {
      method: 'POST',
      ...authHeaders(state.user1.token),
      body: { email: state.user2.email }
    });
    assertEqual(status, 409, 'Status code');
  });

  await test('GET /contacts - lists added contact', async () => {
    const { status, data } = await api('/contacts', authHeaders(state.user1.token));
    assertEqual(status, 200, 'Status code');
    assertEqual(data.count, 1, 'Count is 1');
    assertEqual(data.contacts[0].contact.email, state.user2.email, 'Contact email');
    assertEqual(data.contacts[0].mutual, false, 'Not mutual yet');
  });

  await test('GET /contacts?action=followers - user 2 sees user 1 as follower', async () => {
    const { status, data } = await api('/contacts?action=followers', authHeaders(state.user2.token));
    assertEqual(status, 200, 'Status code');
    assertEqual(data.count, 1, 'Has 1 follower');
    assertEqual(data.followers[0].email, state.user1.email, 'Follower email');
  });

  await test('POST /contacts - user 2 adds user 1 back (mutual)', async () => {
    const { status, data } = await api('/contacts', {
      method: 'POST',
      ...authHeaders(state.user2.token),
      body: { email: state.user1.email }
    });
    assertEqual(status, 201, 'Status code');
    assertEqual(data.success, true, 'Success flag');
  });

  await test('GET /contacts - shows mutual contact', async () => {
    const { status, data } = await api('/contacts', authHeaders(state.user1.token));
    assertEqual(status, 200, 'Status code');
    assertEqual(data.contacts[0].mutual, true, 'Contact is now mutual');
  });

  // ============ MESSAGES ============
  suite('Messages');

  await test('GET /messages - missing contact_id returns 400', async () => {
    const { status } = await api('/messages', authHeaders(state.user1.token));
    assertEqual(status, 400, 'Status code');
  });

  await test('GET /messages - empty message history', async () => {
    const { status, data } = await api(
      `/messages?contact_id=${state.user2.id}`,
      authHeaders(state.user1.token)
    );
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'messages', 'Response has messages');
    assertEqual(data.messages.length, 0, 'No messages yet');
  });

  await test('POST /messages - send text message', async () => {
    const { status, data } = await api('/messages', {
      method: 'POST',
      ...authHeaders(state.user1.token),
      body: { contact_id: state.user2.id, content: 'Hello from e2e test!' }
    });
    assertEqual(status, 201, 'Status code');
    assertEqual(data.success, true, 'Success flag');
    assertContains(data, 'message', 'Response has message');
    assertEqual(data.message.content, 'Hello from e2e test!', 'Message content');
    assertEqual(data.message.is_ping, false, 'Not a ping');
  });

  await test('POST /messages - send ping 👋', async () => {
    const { status, data } = await api('/messages', {
      method: 'POST',
      ...authHeaders(state.user1.token),
      body: { contact_id: state.user2.id, is_ping: true }
    });
    assertEqual(status, 201, 'Status code');
    assertEqual(data.success, true, 'Success flag');
    assertEqual(data.message.is_ping, true, 'Is a ping');
    assertEqual(data.message.content, '👋', 'Ping content');
  });

  await test('GET /messages - shows sent messages', async () => {
    const { status, data } = await api(
      `/messages?contact_id=${state.user2.id}`,
      authHeaders(state.user1.token)
    );
    assertEqual(status, 200, 'Status code');
    assertEqual(data.messages.length, 2, 'Two messages');
    assertEqual(data.messages[0].content, 'Hello from e2e test!', 'First message');
    assertEqual(data.messages[1].is_ping, true, 'Second is ping');
  });

  await test('GET /messages - user 2 receives messages', async () => {
    const { status, data } = await api(
      `/messages?contact_id=${state.user1.id}`,
      authHeaders(state.user2.token)
    );
    assertEqual(status, 200, 'Status code');
    assertEqual(data.messages.length, 2, 'Two messages received');
  });

  // ============ ADDITIONAL ENDPOINTS ============
  suite('Other Endpoints');

  await test('GET /waitlist - returns count', async () => {
    const { status, data } = await api('/waitlist');
    assertEqual(status, 200, 'Status code');
    assertContains(data, 'count', 'Response has count');
  });

  await test('GET /user-profile - returns profile', async () => {
    const { status, data } = await api('/user-profile', authHeaders(state.user1.token));
    assertEqual(status, 200, 'Status code');
  });

  // ============ ERROR HANDLING ============
  suite('Error Handling');

  await test('Invalid endpoint returns 400', async () => {
    const { status } = await api('/auth?action=invalid');
    assertEqual(status, 400, 'Status code');
  });

  await test('Protected endpoints without auth return 401', async () => {
    const { status } = await api('/contacts');
    assertEqual(status, 401, 'Status code');
  });

  // ============ CLEANUP ============
  suite('Cleanup');

  await test('DELETE /contacts - remove contact', async () => {
    // First get the contact ID
    const { data: contactsData } = await api('/contacts', authHeaders(state.user1.token));
    const contactRowId = contactsData.contacts[0]?.id;
    
    if (contactRowId) {
      const { status, data } = await api(`/contacts?id=${contactRowId}`, {
        method: 'DELETE',
        ...authHeaders(state.user1.token)
      });
      assertEqual(status, 200, 'Status code');
      assertEqual(data.success, true, 'Success flag');
    }
  });

  // ============ RESULTS ============
  console.log('\n━━━ RESULTS ━━━');
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⏭️  Skipped: ${results.summary.skipped}`);
  console.log(`📊 Total: ${results.tests.length}`);

  // Write results to file
  const resultsPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to ${resultsPath}`);

  // Exit with appropriate code
  if (results.summary.failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
