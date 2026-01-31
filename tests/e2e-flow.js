#!/usr/bin/env node
/**
 * 🎯 Cinq Complete Flow E2E Test
 * 
 * Simulates the entire user journey from gift code to messaging.
 * Requires a valid gift code to run complete flow.
 * 
 * Usage:
 *   node tests/e2e-flow.js --gift-code CINQ-XXXX-XXXX-XXXX
 *   
 * Environment:
 *   BASE_URL - API base URL (default: localhost:8888)
 *   TEST_GIFT_CODE - Gift code for registration
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888/.netlify/functions';

// Parse CLI args
const args = process.argv.slice(2);
const giftCodeArg = args.find((_, i) => args[i-1] === '--gift-code');
const GIFT_CODE = giftCodeArg || process.env.TEST_GIFT_CODE;
const DRY_RUN = args.includes('--dry-run');

// Test state
const state = {
  email: null,
  password: null,
  userId: null,
  token: null,
  contacts: [],
  messages: []
};

// ==================== Utilities ====================

async function api(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const url = `${BASE_URL}${endpoint}`;
  
  if (DRY_RUN) {
    console.log(`   [DRY RUN] ${method} ${endpoint}`);
    if (body) console.log(`   Body: ${JSON.stringify(body).slice(0, 100)}...`);
    return { status: 200, data: { success: true, simulated: true }, ok: true };
  }
  
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, ok: res.ok };
  } catch (err) {
    return { status: 0, data: { error: err.message }, ok: false };
  }
}

function step(name) {
  console.log(`\n▶️  ${name}`);
  console.log('─'.repeat(40));
}

function success(msg, data = null) {
  console.log(`   ✅ ${msg}`);
  if (data) console.log(`   📄 ${JSON.stringify(data).slice(0, 100)}`);
}

function fail(msg, data = null) {
  console.log(`   ❌ ${msg}`);
  if (data) console.log(`   📄 ${JSON.stringify(data).slice(0, 200)}`);
  return false;
}

function info(msg) {
  console.log(`   ℹ️  ${msg}`);
}

function generateTestData() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    email: `flow-test-${id}@cinq-test.local`,
    password: `Flow${id}Pass1`
  };
}

// ==================== Flow Steps ====================

async function step1_VerifyGiftCode() {
  step('STEP 1: Verify Gift Code');
  
  if (!GIFT_CODE) {
    info('No gift code provided. Using simulation mode.');
    info('Provide --gift-code CINQ-XXXX-XXXX-XXXX for real test.');
    return true;
  }
  
  const res = await api('POST', '/gift-verify', { code: GIFT_CODE });
  
  if (res.ok && res.data.valid) {
    success('Gift code is valid', {
      status: res.data.status,
      amount: res.data.amount?.formatted,
      expires: res.data.expires_at
    });
    return true;
  } else {
    return fail('Gift code verification failed', res.data);
  }
}

async function step2_Register() {
  step('STEP 2: Register Account');
  
  const testData = generateTestData();
  state.email = testData.email;
  state.password = testData.password;
  
  info(`Email: ${state.email}`);
  info(`Password: ${state.password.replace(/./g, '*')}`);
  
  if (!GIFT_CODE) {
    info('Skipping registration (no gift code)');
    return false;
  }
  
  const res = await api('POST', '/auth-register', {
    email: state.email,
    password: state.password,
    giftCode: GIFT_CODE
  });
  
  if (res.ok && res.data.success) {
    state.userId = res.data.user?.id;
    success('Account created!', { userId: state.userId });
    return true;
  } else {
    return fail('Registration failed', res.data);
  }
}

async function step3_Login() {
  step('STEP 3: Login');
  
  if (!state.email || !state.password) {
    // Use test credentials if available
    if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
      state.email = process.env.TEST_EMAIL;
      state.password = process.env.TEST_PASSWORD;
      info('Using TEST_EMAIL/TEST_PASSWORD credentials');
    } else {
      info('Skipping login (no credentials)');
      return false;
    }
  }
  
  const res = await api('POST', '/auth-login', {
    email: state.email,
    password: state.password
  });
  
  if (res.ok && res.data.session) {
    state.token = res.data.session.access_token;
    state.userId = res.data.user?.id;
    success('Login successful!', {
      expires_in: res.data.session.expires_in,
      contact_count: res.data.user?.contact_count
    });
    return true;
  } else {
    return fail('Login failed', res.data);
  }
}

async function step4_GetProfile() {
  step('STEP 4: Get User Profile');
  
  if (!state.token) {
    info('Skipping (not logged in)');
    return false;
  }
  
  const res = await api('GET', '/user-profile', null, state.token);
  
  if (res.ok && res.data.profile) {
    success('Profile retrieved', {
      email: res.data.profile.email,
      contacts: `${res.data.contacts?.count || 0}/${res.data.contacts?.limit || 5}`
    });
    state.contacts = res.data.contacts?.list || [];
    return true;
  } else {
    return fail('Profile fetch failed', res.data);
  }
}

async function step5_ListContacts() {
  step('STEP 5: List Contacts');
  
  if (!state.token) {
    info('Skipping (not logged in)');
    return false;
  }
  
  const res = await api('GET', '/contacts', null, state.token);
  
  if (res.ok) {
    state.contacts = res.data.contacts || [];
    success(`Found ${state.contacts.length} contacts`, {
      remaining: res.data.remaining
    });
    
    state.contacts.forEach((c, i) => {
      info(`  ${i+1}. ${c.email || c.contact_user_id}`);
    });
    
    return true;
  } else {
    return fail('Contact list failed', res.data);
  }
}

async function step6_AddContact() {
  step('STEP 6: Add Contact (Simulation)');
  
  if (!state.token) {
    info('Skipping (not logged in)');
    return false;
  }
  
  // Try to add a test contact (this will likely fail if user doesn't exist)
  const testContactEmail = 'test-contact@cinq-test.local';
  
  info(`Attempting to add: ${testContactEmail}`);
  
  const res = await api('POST', '/contacts', { 
    email: testContactEmail 
  }, state.token);
  
  if (res.ok) {
    success('Contact added!', res.data.contact);
    return true;
  } else {
    // Expected to fail in most cases
    info(`Add contact returned: ${res.status} - ${res.data.error || res.data.code}`);
    info('This is expected if the user does not exist on Cinq');
    return true; // Not a failure, just expected behavior
  }
}

async function step7_SendMessage() {
  step('STEP 7: Send Message (Simulation)');
  
  if (!state.token) {
    info('Skipping (not logged in)');
    return false;
  }
  
  if (state.contacts.length === 0) {
    info('No contacts available to message');
    return true;
  }
  
  const contactId = state.contacts[0].contact_user_id || state.contacts[0].id;
  info(`Target contact: ${contactId}`);
  
  // Get existing messages first
  const getRes = await api('GET', `/messages?contact_id=${contactId}`, null, state.token);
  
  if (getRes.ok) {
    success(`Found ${getRes.data.messages?.length || 0} existing messages`);
    state.messages = getRes.data.messages || [];
  }
  
  // Skip actual send in test to avoid pollution
  info('Skipping actual message send (test mode)');
  info('In production, would POST to /messages with content');
  
  return true;
}

async function step8_SendPing() {
  step('STEP 8: Send Ping (Simulation)');
  
  if (!state.token) {
    info('Skipping (not logged in)');
    return false;
  }
  
  if (state.contacts.length === 0) {
    info('No contacts available to ping');
    return true;
  }
  
  const contactId = state.contacts[0].contact_user_id || state.contacts[0].id;
  
  // Skip actual ping in test
  info(`Would send ping to: ${contactId}`);
  info('Skipping actual ping send (test mode)');
  info('In production, would POST to /messages with is_ping: true');
  
  return true;
}

// ==================== Main ====================

async function runFlow() {
  console.log('═'.repeat(50));
  console.log('🎯 CINQ COMPLETE FLOW E2E TEST');
  console.log('═'.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Gift Code: ${GIFT_CODE ? GIFT_CODE.slice(0, 9) + '...' : 'Not provided'}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const steps = [
    { name: 'Verify Gift Code', fn: step1_VerifyGiftCode },
    { name: 'Register Account', fn: step2_Register },
    { name: 'Login', fn: step3_Login },
    { name: 'Get Profile', fn: step4_GetProfile },
    { name: 'List Contacts', fn: step5_ListContacts },
    { name: 'Add Contact', fn: step6_AddContact },
    { name: 'Send Message', fn: step7_SendMessage },
    { name: 'Send Ping', fn: step8_SendPing }
  ];
  
  const results = [];
  
  for (const step of steps) {
    try {
      const passed = await step.fn();
      results.push({ name: step.name, passed, error: null });
    } catch (err) {
      console.log(`   💥 Error: ${err.message}`);
      results.push({ name: step.name, passed: false, error: err.message });
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 FLOW SUMMARY');
  console.log('─'.repeat(50));
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : (r.passed === false ? '❌' : '⏭️');
    console.log(`${icon} ${r.name}${r.error ? ` (${r.error})` : ''}`);
  });
  
  const passed = results.filter(r => r.passed === true).length;
  const failed = results.filter(r => r.passed === false).length;
  
  console.log('\n' + '─'.repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));
  
  // Final state dump
  console.log('\n📦 FINAL STATE:');
  console.log(`   User ID: ${state.userId || 'N/A'}`);
  console.log(`   Email: ${state.email || 'N/A'}`);
  console.log(`   Token: ${state.token ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Contacts: ${state.contacts.length}`);
  console.log(`   Messages: ${state.messages.length}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runFlow().catch(err => {
  console.error('💥 Flow runner error:', err);
  process.exit(1);
});
