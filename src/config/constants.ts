/**
 * CINQ Constants
 * Single source of truth for all app configuration
 */

// ============================================
// Environment
// ============================================

const getEnv = (key: string, fallback?: string): string => {
  const value = import.meta.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const ENV = {
  SUPABASE_URL: getEnv('VITE_SUPABASE_URL', 'https://guioxfulihyehrwytxce.supabase.co'),
  SUPABASE_ANON_KEY: getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aW94ZnVsaWh5ZWhyd3l0eGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDg5NjUsImV4cCI6MjA4NTM4NDk2NX0.pLvhH3dEYGH7EQCFxUwtvhscLamKVnsWRNnrT412YHQ'
  ),
  API_BASE: '/.netlify/functions',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;

// ============================================
// API Endpoints
// ============================================

export const API = {
  CONTACTS: `${ENV.API_BASE}/contacts`,
  MESSAGES: `${ENV.API_BASE}/messages`,
  WAITLIST: `${ENV.API_BASE}/waitlist`,
  AUTH: {
    LOGIN: `${ENV.API_BASE}/auth-login`,
    REGISTER: `${ENV.API_BASE}/auth-register`,
  },
  GIFT: {
    CREATE: `${ENV.API_BASE}/gift-create`,
    REDEEM: `${ENV.API_BASE}/gift-redeem`,
    VERIFY: `${ENV.API_BASE}/gift-verify`,
  },
} as const;

// ============================================
// App Limits
// ============================================

export const LIMITS = {
  MAX_CONTACTS: 5,
  MAX_MESSAGE_LENGTH: 500,
  MAX_EMAIL_LENGTH: 254,
  MESSAGE_FETCH_LIMIT: 50,
  DEBOUNCE_MS: 300,
  TOAST_DURATION_MS: 3000,
  SESSION_CHECK_INTERVAL_MS: 60_000,
} as const;

// ============================================
// UI Constants
// ============================================

export const UI = {
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  EASING: {
    DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
    SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    OUT_EXPO: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  COLORS: {
    BRAND: '#6366f1',
    BRAND_HOVER: '#4f46e5',
    SUCCESS: '#22c55e',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',
  },
  CONFETTI_COLORS: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#22c55e', '#eab308'],
} as const;

// ============================================
// Validation Patterns
// ============================================

export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'cinq_auth_token',
  THEME: 'cinq_theme',
  ONBOARDING_COMPLETE: 'cinq_onboarding',
} as const;

// ============================================
// Copy / Microcopy
// ============================================

export const COPY = {
  GREETINGS: [
    'Salut',
    'Hey',
    'Yo',
    'Coucou',
    'Hello',
    'Wesh',
    'Bien le bonjour',
    'Oh tiens',
    'Re',
    'Bienvenue',
    'Ah te voilà',
    "On t'attendait",
  ],
  EMPTY_STATES: [
    'Pas encore de messages.\nLe silence aussi a du sens. 🌙',
    "C'est calme ici.\nParfois, ça fait du bien. ✨",
    "Rien pour l'instant.\nMais la qualité > la quantité. 💜",
    'Vide pour le moment.\nComme le frigo un dimanche soir. 🌚',
    'Pas de messages.\nPeut-être que c\'est toi qui devrais écrire ? 🤔',
    "Silence radio.\nC'est pas Instagram ici, on se presse pas. 🧘",
    'Zéro message.\nMais zéro drama aussi, c\'est le deal. ✌️',
  ],
  LOADING: [
    "On compte jusqu'à 5...",
    'Patience, jeune padawan...',
    'Chargement zen en cours...',
    "Un instant de calme...",
    'Les petits cercles tournent...',
    'On réfléchit (pas trop)...',
    'Ça charge, tranquille...',
    'Méditation en cours...',
    'Respire, ça arrive...',
  ],
} as const;
