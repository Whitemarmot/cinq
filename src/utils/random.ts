/**
 * CINQ Random Utilities
 * Pure functions for randomization
 */

import { COPY } from '@/config/constants';

// ============================================
// Generic Random
// ============================================

export const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randomFloat = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export const randomItem = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export const randomItems = <T>(items: readonly T[], count: number): T[] => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const randomBoolean = (probability = 0.5): boolean =>
  Math.random() < probability;

// ============================================
// Cinq-specific Random Copy
// ============================================

export const getRandomGreeting = (): string =>
  randomItem(COPY.GREETINGS);

export const getRandomEmptyState = (): string =>
  randomItem(COPY.EMPTY_STATES);

export const getRandomLoadingText = (): string =>
  randomItem(COPY.LOADING);

// ============================================
// ID Generation
// ============================================

export const generateId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const generateShortId = (length = 6): string =>
  Math.random().toString(36).slice(2, 2 + length).toUpperCase();
