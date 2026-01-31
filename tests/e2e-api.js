#!/usr/bin/env node
/**
 * 🧪 Cinq E2E API Tests
 * 
 * Tests all API endpoints for the complete user flow.
 * Run: node tests/e2e-api.js [--base-url URL]
 */

const BASE_URL = process.argv.includes('--base-url') 
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : process.env.BASE_URL || 'http://localhost:8888/.netlify/functions';

// Test state
let testResults = [];
let testToken = null;
let testUserId = null;
let testContactId = null;

// ==================== Utilities ====================

async function api(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, ok: res.ok };
  } catch (err) {
    return { status: 0, data: { error: err.message }, ok: false };
  }
}

function test(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${details ? ` — ${details}` : ''}`);
  testResults.push({ name, passed, details });
  return passed;
}

function generateEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@cinq-test.local`;
}

// ==================== Test Suites ====================

async function testWaitlist() {
  console.log('\n📋 WAITLIST TESTS');
  console.log('─'.repeat(40));
  
  const email = generateEmail();
  
  // Test 1: Get waitlist count
  const countRes = await api('GET', '/waitlist');
  test('GET /waitlist returns count', 
    countRes.ok && typeof countRes.data.count === 'number',
    `count: ${countRes.data.count}`);
  
  // Test 2: Sign up to waitlist
  const signupRes = await api('POST', '/waitlist', { email });
  test('POST /waitlist - new signup', 
    signupRes.status === 201 && signupRes.data.success,
    signupRes.data.message || '');
  
  // Test 3: Duplicate signup
  const dupeRes = await api('POST', '/waitlist', { email });
  test('POST /waitlist - duplicate rejected',
    dupeRes.status === 409,
    dupeRes.data.code || '');
  
  // Test 4: Invalid email
  const invalidRes = await api('POST', '/waitlist', { email: 'invalid' });
  test('POST /waitlist - invalid email rejected',
    invalidRes.status === 400,
    'Bad request');
}

async function testGiftFlow() {
  console.log('\n🎁 GIFT CODE TESTS');
  console.log('─'.repeat(40));
  
  // Test gift-verify with invalid code
  const verifyInvalid = await api('POST', '/gift-verify', { 
    code: 'CINQ-0000-0000-0000' 
  });
  test('POST /gift-verify - invalid code returns error',
    verifyInvalid.status === 404 || !verifyInvalid.data.valid,
    'Code not found');
  
  // Test gift-verify with bad format
  const verifyBadFormat = await api('POST', '/gift-verify', { 
    code: 'BADFORMAT' 
  });
  test('POST /gift-verify - bad format rejected',
    verifyBadFormat.status === 400 || !verifyBadFormat.data.valid,
    'Invalid format');
  
  // Note: Cannot test gift creation without service auth
  console.log('ℹ️  Gift creation requires service authentication (webhook)');
}

async function testAuth(testGiftCode) {
  console.log('\n🔐 AUTH TESTS');
  console.log('─'.repeat(40));
  
  const email = generateEmail();
  const password = 'TestPass123';
  
  // Test 1: Register without gift code
  const regNoCode = await api('POST', '/auth-register', {
    email,
    password,
    giftCode: ''
  });
  test('POST /auth-register - requires gift code',
    regNoCode.status === 400,
    'Gift code required');
  
  // Test 2: Register with invalid gift code
  const regInvalidCode = await api('POST', '/auth-register', {
    email,
    password,
    giftCode: 'CINQ-0000-0000-0000'
  });
  test('POST /auth-register - invalid code rejected',
    regInvalidCode.status === 400 || regInvalidCode.status === 404,
    'Invalid gift code');
  
  // Test 3: Register with weak password
  const regWeakPass = await api('POST', '/auth-register', {
    email,
    password: '123',
    giftCode: testGiftCode || 'CINQ-TEST-CODE-0001'
  });
  test('POST /auth-register - weak password rejected',
    regWeakPass.status === 400,
    'Password too weak');
  
  // Test 4: Login with non-existent user
  const loginFail = await api('POST', '/auth-login', {
    email: 'nonexistent@example.com',
    password: 'anypass'
  });
  test('POST /auth-login - non-existent user rejected',
    loginFail.status === 401,
    'Invalid credentials');
  
  // Test 5: Login with empty fields
  const loginEmpty = await api('POST', '/auth-login', {
    email: '',
    password: ''
  });
  test('POST /auth-login - empty fields rejected',
    loginEmpty.status === 400,
    'Missing fields');
  
  // If we have test credentials, test successful login
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    const loginSuccess = await api('POST', '/auth-login', {
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD
    });
    if (test('POST /auth-login - valid credentials accepted',
      loginSuccess.ok && loginSuccess.data.session,
      'Token received')) {
      testToken = loginSuccess.data.session.access_token;
      testUserId = loginSuccess.data.user?.id;
    }
  } else {
    console.log('ℹ️  Set TEST_EMAIL and TEST_PASSWORD to test successful login');
  }
}

async function testContacts() {
  console.log('\n👥 CONTACTS TESTS');
  console.log('─'.repeat(40));
  
  if (!testToken) {
    console.log('⏭️  Skipped - no auth token available');
    return;
  }
  
  // Test 1: Get contacts (auth required)
  const getContacts = await api('GET', '/contacts', null, testToken);
  test('GET /contacts - returns contact list',
    getContacts.ok && Array.isArray(getContacts.data.contacts),
    `count: ${getContacts.data.count || 0}`);
  
  // Test 2: Get contacts without auth
  const getNoAuth = await api('GET', '/contacts');
  test('GET /contacts - requires auth',
    getNoAuth.status === 401,
    'Unauthorized');
  
  // Test 3: Add self as contact
  if (process.env.TEST_EMAIL) {
    const addSelf = await api('POST', '/contacts', { 
      email: process.env.TEST_EMAIL 
    }, testToken);
    test('POST /contacts - cannot add self',
      addSelf.status === 400 && addSelf.data.code === 'SELF_ADD',
      'Self-add blocked');
  }
  
  // Test 4: Add non-existent user
  const addNonExistent = await api('POST', '/contacts', { 
    email: 'definitely-not-exists-12345@example.com' 
  }, testToken);
  test('POST /contacts - non-existent user rejected',
    addNonExistent.status === 404,
    'User not found');
  
  // Test 5: Add contact with invalid email
  const addInvalid = await api('POST', '/contacts', { 
    email: 'not-an-email' 
  }, testToken);
  test('POST /contacts - invalid email rejected',
    addInvalid.status === 400,
    'Invalid email');
  
  // If we have existing contacts, get one for message tests
  if (getContacts.ok && getContacts.data.contacts?.length > 0) {
    testContactId = getContacts.data.contacts[0].contact_user_id || 
                    getContacts.data.contacts[0].id;
    console.log(`ℹ️  Using contact ${testContactId} for message tests`);
  }
}

async function testMessages() {
  console.log('\n💬 MESSAGES TESTS');
  console.log('─'.repeat(40));
  
  if (!testToken) {
    console.log('⏭️  Skipped - no auth token available');
    return;
  }
  
  // Test 1: Get messages without contact_id
  const getMsgNoId = await api('GET', '/messages', null, testToken);
  test('GET /messages - requires contact_id',
    getMsgNoId.status === 400,
    'Missing contact_id');
  
  // Test 2: Get messages with invalid contact
  const getMsgInvalid = await api('GET', '/messages?contact_id=invalid-uuid', null, testToken);
  test('GET /messages - invalid contact rejected',
    getMsgInvalid.status === 400 || getMsgInvalid.status === 403,
    'Invalid contact');
  
  // Test 3: Send message without auth
  const sendNoAuth = await api('POST', '/messages', { 
    contact_id: 'test',
    content: 'Hello' 
  });
  test('POST /messages - requires auth',
    sendNoAuth.status === 401,
    'Unauthorized');
  
  // Test 4: Send message without content
  const sendEmpty = await api('POST', '/messages', { 
    contact_id: testContactId || 'test'
  }, testToken);
  test('POST /messages - requires content or ping',
    sendEmpty.status === 400,
    'Missing content');
  
  if (testContactId) {
    // Test 5: Get messages with valid contact
    const getMessages = await api(
      'GET', 
      `/messages?contact_id=${testContactId}`, 
      null, 
      testToken
    );
    test('GET /messages - returns message list',
      getMessages.ok && Array.isArray(getMessages.data.messages),
      `count: ${getMessages.data.count || 0}`);
    
    // Note: Not sending actual messages in tests to avoid spam
    console.log('ℹ️  Skipping message send to avoid test data pollution');
  }
}

async function testUserProfile() {
  console.log('\n👤 USER PROFILE TESTS');
  console.log('─'.repeat(40));
  
  // Test 1: Get profile without auth
  const noAuth = await api('GET', '/user-profile');
  test('GET /user-profile - requires auth',
    noAuth.status === 401,
    'Unauthorized');
  
  if (!testToken) {
    console.log('⏭️  Authenticated tests skipped - no token');
    return;
  }
  
  // Test 2: Get profile with auth
  const profile = await api('GET', '/user-profile', null, testToken);
  test('GET /user-profile - returns profile',
    profile.ok && profile.data.profile,
    profile.data.profile?.email || '');
  
  // Test 3: Check contacts structure
  test('GET /user-profile - includes contacts',
    profile.ok && profile.data.contacts && typeof profile.data.contacts.limit === 'number',
    `limit: ${profile.data.contacts?.limit || 'N/A'}`);
}

// ==================== Main ====================

async function runAllTests() {
  console.log('🧪 CINQ E2E API TESTS');
  console.log('═'.repeat(40));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const testGiftCode = process.env.TEST_GIFT_CODE || null;
  
  await testWaitlist();
  await testGiftFlow();
  await testAuth(testGiftCode);
  await testContacts();
  await testMessages();
  await testUserProfile();
  
  // Summary
  console.log('\n' + '═'.repeat(40));
  console.log('📊 TEST SUMMARY');
  console.log('─'.repeat(40));
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  const total = testResults.length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${total}`);
  console.log(`📈 Rate: ${((passed/total)*100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}`);
    });
  }
  
  console.log('\n' + '═'.repeat(40));
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('💥 Test runner error:', err);
  process.exit(1);
});
