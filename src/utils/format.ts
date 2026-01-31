/**
 * CINQ Formatting Utilities
 * Pure functions for data transformation
 */

// ============================================
// Email Formatting
// ============================================

export const getEmailPrefix = (email: string): string => 
  email.split('@')[0];

export const getEmailInitial = (email: string): string =>
  getEmailPrefix(email).charAt(0).toUpperCase();

// ============================================
// Time Formatting
// ============================================

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 604_800_000;

export const formatRelativeTime = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (diffMs < MINUTE_MS) return "à l'instant";
  if (diffMs < HOUR_MS) return `il y a ${Math.floor(diffMs / MINUTE_MS)}min`;
  if (diffMs < DAY_MS) return `il y a ${Math.floor(diffMs / HOUR_MS)}h`;
  if (diffMs < WEEK_MS) return `il y a ${Math.floor(diffMs / DAY_MS)}j`;
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const formatDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTime = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// Number Formatting
// ============================================

export const formatNumber = (num: number): string =>
  num.toLocaleString('fr-FR');

export const formatCompactNumber = (num: number): string => {
  if (num < 1000) return String(num);
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}k`;
  return `${(num / 1_000_000).toFixed(1)}M`;
};

// ============================================
// Text Formatting
// ============================================

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const truncate = (text: string, maxLength: number, suffix = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trim() + suffix;
};

export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

// ============================================
// URL Formatting
// ============================================

export const getUrlParams = (): URLSearchParams =>
  new URLSearchParams(window.location.search);

export const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  
  return searchParams.toString();
};
