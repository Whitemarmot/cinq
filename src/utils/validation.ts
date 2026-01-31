/**
 * CINQ Validation Utilities
 * Pure functions for input validation
 */

import { PATTERNS, LIMITS } from '@/config/constants';

// ============================================
// Email Validation
// ============================================

export const isValidEmail = (email: unknown): email is string => {
  if (typeof email !== 'string') return false;
  if (email.length > LIMITS.MAX_EMAIL_LENGTH) return false;
  return PATTERNS.EMAIL.test(email);
};

export const normalizeEmail = (email: string): string => 
  email.toLowerCase().trim();

export const validateEmail = (email: unknown): { valid: true; value: string } | { valid: false; error: string } => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email requis' };
  }
  
  const normalized = normalizeEmail(email);
  
  if (!isValidEmail(normalized)) {
    return { valid: false, error: 'Format email invalide' };
  }
  
  return { valid: true, value: normalized };
};

// ============================================
// UUID Validation
// ============================================

export const isValidUUID = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return PATTERNS.UUID.test(value);
};

export const validateUUID = (value: unknown, fieldName = 'ID'): { valid: true; value: string } | { valid: false; error: string } => {
  if (!isValidUUID(value)) {
    return { valid: false, error: `${fieldName} invalide` };
  }
  return { valid: true, value };
};

// ============================================
// Message Content Validation
// ============================================

export const sanitizeContent = (content: unknown): string => {
  if (!content || typeof content !== 'string') return '';
  return content.trim().slice(0, LIMITS.MAX_MESSAGE_LENGTH);
};

export const validateMessageContent = (
  content: unknown, 
  isPing = false
): { valid: true; value: string } | { valid: false; error: string } => {
  if (isPing) {
    return { valid: true, value: '💫' };
  }
  
  const sanitized = sanitizeContent(content);
  
  if (!sanitized) {
    return { valid: false, error: 'Message requis' };
  }
  
  return { valid: true, value: sanitized };
};

// ============================================
// Password Validation
// ============================================

export const validatePassword = (password: unknown): { valid: true; value: string } | { valid: false; error: string } => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Mot de passe requis' };
  }
  
  if (password.length < 6) {
    return { valid: false, error: 'Mot de passe trop court (min 6 caractères)' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Mot de passe trop long' };
  }
  
  return { valid: true, value: password };
};

// ============================================
// Generic Validators
// ============================================

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value) && value > 0;

export const isWithinRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;
