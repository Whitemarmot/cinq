/**
 * ==========================================================================
 * CINQ - App Page JavaScript
 * ==========================================================================
 * 
 * Main application logic for authenticated users:
 * - Contact management (add, remove, list)
 * - Chat/messaging with contacts
 * - Ping feature
 * - Real-time message updates
 * - Push notifications integration
 * 
 * Dependencies:
 * - Supabase client (loaded via CDN)
 * - /js/common.js (Cinq namespace)
 * - /js/notifications.js (CinqNotifications)
 * 
 * @author Cinq Team
 * @version 1.1.0
 */

'use strict';

/**
 * CinqApp - Main application module
 * Handles all authenticated user functionality
 */
const CinqApp = (function() {
  
  // ============================================
  // Dependencies from common.js
  // ============================================
  const { 
    $, escapeHtml, announce, showError, hideError,
    formatRelativeTime, getEmailPrefix, apiCall,
    getAccessToken
  } = window.Cinq;
  
  // ============================================
  // Configuration
  // ============================================
  
  /**
   * Supabase configuration
   * @constant
   */
  const SUPABASE_URL = 'https://guioxfulihyehrwytxce.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aW94ZnVsaWh5ZWhyd3l0eGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDg5NjUsImV4cCI6MjA4NTM4NDk2NX0.pLvhH3dEYGH7EQCFxUwtvhscLamKVnsWRNrT412YHQ';
  
  /**
   * API base URL for messages
   * @constant
   */
  const API_BASE = '/.netlify/functions';
  
  // ============================================
  // State
  // ============================================
  
  /** @type {Object|null} Current authenticated user */
  let currentUser = null;
  
  /** @type {Array} List of user's contacts */
  let contacts = [];
  
  /** @type {Object|null} Currently selected contact for chat */
  let selectedContact = null;
  
  /** @type {Array} Messages in current chat */
  let messages = [];
  
  /** @type {string|null} Contact ID pending removal */
  let contactToRemove = null;
  
  /** @type {Object|null} Supabase client instance */
  let db = null;
  
  // ============================================
  // Screen Management
  // ============================================
  
  /**
   * Show a specific screen and hide others
   * @param {string} name - Screen name: 'loading', 'auth', 'app'
   */
  function showScreen(name) {
    const screens = {
      loading: $('screen-loading'),
      auth: $('screen-auth'),
      app: $('screen-app')
    };
    
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
    screens[name]?.classList.remove('hidden');
  }
  
  // ============================================
  // Authentication
  // ============================================
  
  /**
   * Initialize authentication state
   * Checks existing session and sets up auth listeners
   */
  async function initAuth() {
    // Initialize Supabase client
    if (typeof supabase !== 'undefined') {
      db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase client not loaded');
      showScreen('auth');
      return;
    }
    
    // Check existing session
    const { data: { session } } = await db.auth.getSession();
    
    if (session?.user) {
      currentUser = session.user;
      await loadApp();
    } else {
      showScreen('auth');
    }
    
    // Listen for auth changes
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        await loadApp();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showScreen('auth');
      }
    });
  }
  
  /**
   * Handle auth form submission
   * Supports email check, login, and signup flow
   * @param {Event} e - Form submit event
   */
  async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = $('auth-email').value.trim().toLowerCase();
    const password = $('auth-password').value;
    const passwordGroup = $('auth-password-group');
    
    hideError('auth-message');
    
    // Step 1: Email only - show password field
    if (passwordGroup.classList.contains('hidden')) {
      passwordGroup.classList.remove('hidden');
      $('auth-password').required = true;
      $('auth-password').focus();
      return;
    }
    
    // Step 2: Try login
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          // Try signup (might be new user)
          const { data: signupData, error: signupError } = await db.auth.signUp({
            email,
            password
          });
          
          if (signupError) {
            showError('auth-message', signupError.message);
          } else if (signupData.user && !signupData.session) {
            // Email confirmation required
            const msg = $('auth-message');
            msg.textContent = 'Vérifie ton email pour confirmer ton compte.';
            msg.classList.remove('hidden', 'text-red-400');
            msg.classList.add('text-indigo-400');
          }
        } else {
          showError('auth-message', error.message);
        }
      }
    } catch (err) {
      showError('auth-message', 'Erreur de connexion');
    }
  }
  
  /**
   * Handle logout
   */
  async function handleLogout() {
    if (db) {
      await db.auth.signOut();
    }
    Cinq.clearSession();
  }
  
  // ============================================
  // App Loading
  // ============================================
  
  /**
   * Load the main application
   * Called after successful authentication
   */
  async function loadApp() {
    showScreen('app');
    
    // Set greeting
    const name = getEmailPrefix(currentUser.email);
    $('user-greeting').textContent = `Salut, ${name}`;
    
    // Load contacts
    await loadContacts();
    
    // Start realtime subscription
    subscribeToMessages();
  }
  
  // ============================================
  // Contacts Management
  // ============================================
  
  /**
   * Load user's contacts from API
   */
  async function loadContacts() {
    try {
      const data = await apiCall('contacts');
      
      // Transform API response to expected format
      contacts = (data.contacts || []).map(c => ({
        id: c.id,
        contact_user_id: c.user_id,
        created_at: c.added_at,
        contact: { id: c.user_id, email: c.email }
      }));
      
      renderContacts();
    } catch (err) {
      console.error('Error loading contacts:', err);
      contacts = [];
      renderContacts();
    }
  }
  
  /**
   * Render contacts grid
   * Shows existing contacts and empty slots (up to 5)
   */
  function renderContacts() {
    const grid = $('contacts-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Update counter
    $('contacts-count').textContent = `${contacts.length}/5 contacts`;
    
    // Render existing contacts
    contacts.forEach((contact) => {
      const email = contact.contact?.email || 'Contact';
      const name = getEmailPrefix(email);
      const initial = name.charAt(0).toUpperCase();
      
      const slot = document.createElement('div');
      slot.className = 'contact-slot flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer';
      slot.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-indigo-500/30 flex items-center justify-center text-lg font-semibold">
          ${escapeHtml(initial)}
        </div>
        <div class="flex-1">
          <p class="font-medium">${escapeHtml(name)}</p>
          <p class="text-xs text-white/40">${escapeHtml(email)}</p>
        </div>
        <button 
          class="btn-remove-contact p-2 text-white/30 hover:text-red-400 transition" 
          data-id="${contact.id}" 
          data-name="${escapeHtml(name)}"
          aria-label="Retirer ${escapeHtml(name)}"
        >
          ✕
        </button>
      `;
      
      // Click to open chat (not on remove button)
      slot.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-remove-contact')) {
          openChat(contact);
        }
      });
      
      grid.appendChild(slot);
    });
    
    // Render empty slots
    for (let i = contacts.length; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'contact-slot empty flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/20 rounded-xl cursor-pointer';
      slot.innerHTML = `
        <span class="text-white/30">+</span>
        <span class="text-white/30 text-sm">Slot ${i + 1}</span>
      `;
      slot.addEventListener('click', () => openAddContactModal());
      grid.appendChild(slot);
    }
    
    // Attach remove handlers
    grid.querySelectorAll('.btn-remove-contact').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRemoveContactModal(btn.dataset.id, btn.dataset.name);
      });
    });
  }
  
  // ============================================
  // Add Contact Modal
  // ============================================
  
  /**
   * Open the add contact modal
   */
  function openAddContactModal() {
    if (contacts.length >= 5) {
      alert('Tu as déjà 5 contacts. Retire quelqu\'un d\'abord.');
      return;
    }
    $('modal-add-contact').classList.remove('hidden');
    $('contact-email').focus();
  }
  
  /**
   * Close the add contact modal
   */
  function closeAddContactModal() {
    $('modal-add-contact').classList.add('hidden');
    $('contact-email').value = '';
    hideError('add-contact-error');
  }
  
  /**
   * Handle add contact form submission
   * @param {Event} e - Form submit event
   */
  async function handleAddContact(e) {
    e.preventDefault();
    
    const email = $('contact-email').value.trim().toLowerCase();
    hideError('add-contact-error');
    
    // Disable button while loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '...';
    
    try {
      await apiCall('contacts', { method: 'POST', body: { email } });
      
      closeAddContactModal();
      await loadContacts();
    } catch (err) {
      console.error('Add contact error:', err);
      
      // User-friendly error messages
      let message = err.message || 'Erreur lors de l\'ajout';
      
      const errorMessages = {
        'SELF_ADD': 'Tu ne peux pas t\'ajouter toi-même 😅',
        'USER_NOT_FOUND': 'Cette personne n\'est pas encore sur Cinq. Offre-lui un accès !',
        'ALREADY_CONTACT': 'Cette personne est déjà dans ton cercle',
        'LIMIT_REACHED': '5 contacts max. C\'est le concept !'
      };
      
      if (err.code && errorMessages[err.code]) {
        message = errorMessages[err.code];
      }
      
      showError('add-contact-error', message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
  
  // ============================================
  // Remove Contact Modal
  // ============================================
  
  /**
   * Open the remove contact confirmation modal
   * @param {string} contactId - Contact ID
   * @param {string} contactName - Contact name for display
   */
  function openRemoveContactModal(contactId, contactName) {
    contactToRemove = contactId;
    $('remove-contact-text').textContent = `Retirer ${contactName} de ton cercle ?`;
    $('modal-remove-contact').classList.remove('hidden');
  }
  
  /**
   * Close the remove contact modal
   */
  function closeRemoveContactModal() {
    $('modal-remove-contact').classList.add('hidden');
    contactToRemove = null;
  }
  
  /**
   * Handle contact removal confirmation
   */
  async function handleRemoveContact() {
    if (!contactToRemove) return;
    
    const btn = $('btn-confirm-remove');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    
    try {
      await apiCall(`contacts?id=${contactToRemove}`, { method: 'DELETE' });
      
      closeRemoveContactModal();
      
      // If in chat with this contact, go back
      if (selectedContact?.id === contactToRemove) {
        closeChat();
      }
      
      await loadContacts();
    } catch (err) {
      console.error('Error removing contact:', err);
      alert('Erreur lors de la suppression');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
  
  // ============================================
  // Chat / Messages
  // ============================================
  
  /**
   * Open chat with a contact
   * @param {Object} contact - Contact object
   */
  function openChat(contact) {
    selectedContact = contact;
    const name = getEmailPrefix(contact.contact?.email || 'Contact');
    $('chat-contact-name').textContent = name;
    
    $('section-contacts').classList.add('hidden');
    $('section-chat').classList.remove('hidden');
    
    loadMessages();
  }
  
  /**
   * Close current chat and return to contacts
   */
  function closeChat() {
    selectedContact = null;
    messages = [];
    $('section-chat').classList.add('hidden');
    $('section-contacts').classList.remove('hidden');
  }
  
  /**
   * Load messages for current chat
   */
  async function loadMessages() {
    if (!selectedContact) return;
    
    const contactUserId = selectedContact.contact_user_id;
    
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No auth token');
        return;
      }
      
      const response = await fetch(`${API_BASE}/messages?contact_id=${contactUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        messages = result.messages || [];
      } else {
        console.error('Error loading messages:', result.error);
        messages = [];
      }
      
      renderMessages();
    } catch (err) {
      console.error('Error loading messages:', err);
      messages = [];
      renderMessages();
    }
  }
  
  /**
   * Render messages in chat view
   */
  function renderMessages() {
    const list = $('messages-list');
    const empty = $('messages-empty');
    
    if (messages.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    
    list.innerHTML = messages.map(msg => {
      const isMine = msg.is_mine || msg.sender_id === currentUser.id;
      const isPing = msg.is_ping;
      
      if (isPing) {
        return `
          <div class="message text-center">
            <span class="inline-block px-3 py-1 bg-indigo-500/20 rounded-full text-sm">
              💫 ${isMine ? 'Tu as envoyé un ping' : 'Ping reçu'}
            </span>
            <p class="text-xs text-white/30 mt-1">${formatRelativeTime(msg.created_at)}</p>
          </div>
        `;
      }
      
      return `
        <div class="message ${isMine ? 'text-right' : 'text-left'}">
          <div class="inline-block max-w-[80%] px-4 py-2 rounded-2xl ${
            isMine ? 'bg-indigo-500/30 rounded-br-sm' : 'bg-white/10 rounded-bl-sm'
          }">
            <p class="text-sm">${escapeHtml(msg.content)}</p>
          </div>
          <p class="text-xs text-white/30 mt-1">${formatRelativeTime(msg.created_at)}</p>
        </div>
      `;
    }).join('');
    
    scrollToBottom();
  }
  
  /**
   * Scroll messages container to bottom
   */
  function scrollToBottom() {
    const container = $('messages-container');
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
  
  /**
   * Handle message form submission
   * @param {Event} e - Form submit event
   */
  async function handleSendMessage(e) {
    e.preventDefault();
    
    const input = $('message-input');
    const content = input.value.trim();
    
    if (!content || !selectedContact) return;
    
    input.disabled = true;
    
    try {
      const token = await getAccessToken();
      if (!token) {
        alert('Session expirée. Reconnecte-toi.');
        return;
      }
      
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contact_id: selectedContact.contact_user_id,
          content: content
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        input.value = '';
        messages.push(result.message);
        renderMessages();
      } else {
        console.error('Error sending message:', result.error);
        if (result.error.includes('not available')) {
          alert('La messagerie sera bientôt disponible !');
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      input.disabled = false;
      input.focus();
    }
  }
  
  /**
   * Handle ping button click
   */
  async function handlePing() {
    if (!selectedContact) return;
    
    const btn = $('btn-ping');
    btn.disabled = true;
    btn.classList.add('ping-sent');
    
    try {
      const token = await getAccessToken();
      if (!token) {
        alert('Session expirée. Reconnecte-toi.');
        return;
      }
      
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contact_id: selectedContact.contact_user_id,
          is_ping: true
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        messages.push(result.message);
        renderMessages();
      } else {
        console.error('Error sending ping:', result.error);
      }
    } catch (err) {
      console.error('Error sending ping:', err);
    }
    
    setTimeout(() => {
      btn.classList.remove('ping-sent');
      btn.disabled = false;
    }, 500);
  }
  
  // ============================================
  // Realtime Subscription
  // ============================================
  
  /**
   * Subscribe to realtime message updates via Supabase
   */
  function subscribeToMessages() {
    if (!db) return;
    
    db.channel('messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (selectedContact && currentUser) {
            const msg = payload.new;
            // Check if message is for current conversation
            if ((msg.sender_id === currentUser.id && msg.receiver_id === selectedContact.contact_user_id) ||
                (msg.sender_id === selectedContact.contact_user_id && msg.receiver_id === currentUser.id)) {
              loadMessages();
            }
          }
        }
      )
      .subscribe();
  }
  
  // ============================================
  // Event Binding
  // ============================================
  
  /**
   * Bind all event listeners
   */
  function bindEvents() {
    // Auth form
    $('auth-form')?.addEventListener('submit', handleAuthSubmit);
    $('btn-logout')?.addEventListener('click', handleLogout);
    
    // Add contact modal
    $('btn-cancel-add')?.addEventListener('click', closeAddContactModal);
    $('add-contact-form')?.addEventListener('submit', handleAddContact);
    
    // Remove contact modal
    $('btn-cancel-remove')?.addEventListener('click', closeRemoveContactModal);
    $('btn-confirm-remove')?.addEventListener('click', handleRemoveContact);
    
    // Chat
    $('btn-back-contacts')?.addEventListener('click', closeChat);
    $('message-form')?.addEventListener('submit', handleSendMessage);
    $('btn-ping')?.addEventListener('click', handlePing);
  }
  
  // ============================================
  // Initialization
  // ============================================
  
  /**
   * Initialize the application
   */
  function init() {
    bindEvents();
    initAuth();
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // ============================================
  // Public API
  // ============================================
  return {
    // Expose for debugging if needed
    getState: () => ({ currentUser, contacts, selectedContact, messages })
  };
  
})();
