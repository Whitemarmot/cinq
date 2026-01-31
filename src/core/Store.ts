/**
 * CINQ Store
 * Minimal reactive state management
 * Pattern: Observable Store
 */

import type { Listener, Unsubscribe } from '@/types';

export interface Store<T> {
  getState(): T;
  setState(partial: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: Listener<T>): Unsubscribe;
  select<S>(selector: (state: T) => S): S;
  subscribeToSlice<S>(
    selector: (state: T) => S,
    listener: Listener<S>,
    equalityFn?: (a: S, b: S) => boolean
  ): Unsubscribe;
}

/**
 * Creates a minimal reactive store
 * Inspired by Zustand's simplicity
 */
export const createStore = <T extends object>(initialState: T): Store<T> => {
  let state = { ...initialState };
  const listeners = new Set<Listener<T>>();

  const notify = (): void => {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('[Store] Error in listener:', error);
      }
    }
  };

  return {
    getState(): T {
      return state;
    },

    setState(partial: Partial<T> | ((state: T) => Partial<T>)): void {
      const nextPartial = typeof partial === 'function' ? partial(state) : partial;
      const nextState = { ...state, ...nextPartial };

      // Only notify if something actually changed
      if (Object.keys(nextPartial).some((key) => state[key as keyof T] !== nextPartial[key as keyof T])) {
        state = nextState;
        notify();
      }
    },

    subscribe(listener: Listener<T>): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    select<S>(selector: (state: T) => S): S {
      return selector(state);
    },

    subscribeToSlice<S>(
      selector: (state: T) => S,
      listener: Listener<S>,
      equalityFn: (a: S, b: S) => boolean = Object.is
    ): Unsubscribe {
      let currentSlice = selector(state);

      return this.subscribe((nextState) => {
        const nextSlice = selector(nextState);
        if (!equalityFn(currentSlice, nextSlice)) {
          currentSlice = nextSlice;
          listener(nextSlice);
        }
      });
    },
  };
};

// ============================================
// Store Utilities
// ============================================

/**
 * Shallow equality comparison for arrays and objects
 */
export const shallowEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
};

/**
 * Creates a persisted store that syncs with localStorage
 */
export const createPersistedStore = <T extends object>(
  key: string,
  initialState: T,
  storage: Storage = localStorage
): Store<T> => {
  // Try to load from storage
  let loadedState = initialState;
  try {
    const stored = storage.getItem(key);
    if (stored) {
      loadedState = { ...initialState, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn(`[Store] Failed to load persisted state for "${key}":`, error);
  }

  const store = createStore(loadedState);
  const originalSetState = store.setState.bind(store);

  // Override setState to persist
  store.setState = (partial) => {
    originalSetState(partial);
    try {
      storage.setItem(key, JSON.stringify(store.getState()));
    } catch (error) {
      console.warn(`[Store] Failed to persist state for "${key}":`, error);
    }
  };

  return store;
};
