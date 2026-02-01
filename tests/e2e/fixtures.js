/**
 * Shared test fixtures and helpers for Cinq E2E tests
 */

export const TEST_USERS = {
  valid: {
    email: 'test@cinq.app',
    password: 'TestPassword123!',
  },
  newUser: {
    email: `test-${Date.now()}@cinq.app`,
    password: 'NewUser123!',
    displayName: 'Test User',
  },
};

export const VALID_GIFT_CODE = 'TEST-GIFT-CODE';

export const SELECTORS = {
  // Login page
  login: {
    form: '#login-form',
    emailInput: '#email',
    passwordInput: '#password',
    submitBtn: '.submit-btn',
    errorMessage: '.message.error',
    successMessage: '.message.success',
    forgotLink: '.forgot-link',
    registerLink: '.register-link a',
    passwordToggle: '#password-toggle-btn',
  },
  
  // Register page
  register: {
    form: '#register-form',
    emailInput: '#email',
    passwordInput: '#password',
    confirmPasswordInput: '#confirm-password',
    displayNameInput: '#display-name',
    giftCodeInput: '#gift-code',
    submitBtn: '.submit-btn',
    errorMessage: '.message.error',
    successMessage: '.message.success',
    loadingIndicator: '#loading',
    invalidCode: '#invalid-code',
    registerFormContainer: '#register-form-container',
    strengthFill: '.strength-fill',
    strengthText: '.strength-text',
  },
  
  // App (main)
  app: {
    header: '.app-header',
    headerAvatar: '.header-avatar',
    themeToggle: '.theme-toggle',
    notificationBtn: '.notification-btn',
    
    // Navigation
    navFeed: '#nav-feed',
    navContacts: '#nav-contacts',
    navProfil: '#nav-profil',
    
    // Tabs
    tabFeed: '#tab-feed',
    tabContacts: '#tab-contacts',
    tabProfil: '#tab-profil',
    
    // Composer (create post)
    composerTextarea: '.composer-textarea',
    composerAvatar: '#composer-avatar',
    composerPhotoBtn: '.composer-btn',
    postBtn: '.publish-btn, .post-btn, button[type="submit"]',
    
    // Feed
    feedPost: '.feed-post, .post-card',
    feedEmpty: '.empty-state',
    
    // Contacts
    contactCard: '.contact-card',
    addContactBtn: '.add-contact-btn, button[onclick*="openAddContactModal"]',
    addContactModal: '#add-contact-modal',
    contactIdInput: '#contact-id-input',
    addContactSubmitBtn: '#add-contact-btn',
    addContactError: '#add-contact-error',
    
    // Chat/Messages
    chatModal: '.chat-modal',
    chatInput: '#chat-input, .chat-input',
    sendBtn: '#send-btn',
    chatMessages: '.chat-messages',
    chatMessage: '.chat-message',
    
    // Profile
    profileSection: '.profile-section',
    settingsBtn: '.settings-btn',
    logoutBtn: '.logout-btn, button[onclick*="logout"]',
  },
  
  // Common
  common: {
    toast: '.toast',
    modal: '.modal-overlay',
    modalClose: '.modal-close',
    loadingSpinner: '.loading-spinner',
    errorAlert: '[role="alert"]',
  },
};

/**
 * Navigate to a page and wait for it to load
 */
export async function navigateTo(page, path) {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Login helper - performs login flow
 */
export async function login(page, email = TEST_USERS.valid.email, password = TEST_USERS.valid.password) {
  await navigateTo(page, '/login.html');
  await page.fill(SELECTORS.login.emailInput, email);
  await page.fill(SELECTORS.login.passwordInput, password);
  await page.click(SELECTORS.login.submitBtn);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page, timeout = 5000) {
  return page.waitForSelector(SELECTORS.common.toast, { timeout });
}

/**
 * Check if user is logged in (on app page)
 */
export async function isLoggedIn(page) {
  return page.url().includes('/app.html') || 
         await page.isVisible(SELECTORS.app.header);
}

/**
 * Mock Supabase auth for testing
 */
export async function mockAuth(page, user = TEST_USERS.valid) {
  await page.evaluate((userData) => {
    localStorage.setItem('sb-auth-token', JSON.stringify({
      access_token: 'mock-token',
      user: {
        id: 'test-user-id',
        email: userData.email,
        user_metadata: { display_name: 'Test User' }
      }
    }));
  }, user);
}

/**
 * Clear auth state
 */
export async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.removeItem('sb-auth-token');
    localStorage.removeItem('supabase.auth.token');
  });
}

/**
 * Switch to a specific tab in the app
 */
export async function switchTab(page, tabName) {
  const tabSelector = {
    feed: SELECTORS.app.navFeed,
    contacts: SELECTORS.app.navContacts,
    profil: SELECTORS.app.navProfil,
  }[tabName];
  
  await page.click(tabSelector);
  await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 5000 });
}
