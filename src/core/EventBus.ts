/**
 * CINQ Event Bus
 * Type-safe pub/sub system for decoupled communication
 * Pattern: Observer
 */

import type { AppEvent, Listener, Unsubscribe } from '@/types';

type EventType = AppEvent['type'];
type EventPayload<T extends EventType> = Extract<AppEvent, { type: T }>['payload'];

interface EventBus {
  emit<T extends EventType>(type: T, payload: EventPayload<T>): void;
  on<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): Unsubscribe;
  once<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): Unsubscribe;
  off<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): void;
  clear(): void;
}

/**
 * Creates a type-safe event bus instance
 * Factory pattern for testability
 */
export const createEventBus = (): EventBus => {
  const listeners = new Map<EventType, Set<Listener<unknown>>>();

  const getListeners = (type: EventType): Set<Listener<unknown>> => {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    return listeners.get(type)!;
  };

  return {
    emit<T extends EventType>(type: T, payload: EventPayload<T>): void {
      const typeListeners = listeners.get(type);
      if (!typeListeners) return;

      // Execute listeners in a try-catch to prevent one failing listener from blocking others
      for (const listener of typeListeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[EventBus] Error in listener for "${type}":`, error);
        }
      }
    },

    on<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): Unsubscribe {
      const typeListeners = getListeners(type);
      typeListeners.add(listener as Listener<unknown>);

      return () => {
        typeListeners.delete(listener as Listener<unknown>);
      };
    },

    once<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): Unsubscribe {
      const wrapper: Listener<EventPayload<T>> = (payload) => {
        listener(payload);
        this.off(type, wrapper);
      };

      return this.on(type, wrapper);
    },

    off<T extends EventType>(type: T, listener: Listener<EventPayload<T>>): void {
      const typeListeners = listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(listener as Listener<unknown>);
      }
    },

    clear(): void {
      listeners.clear();
    },
  };
};

// ============================================
// Global Event Bus Instance (Singleton)
// ============================================

let globalEventBus: EventBus | null = null;

export const getEventBus = (): EventBus => {
  if (!globalEventBus) {
    globalEventBus = createEventBus();
  }
  return globalEventBus;
};

// ============================================
// Convenience Exports
// ============================================

export const emit: EventBus['emit'] = (...args) => getEventBus().emit(...args);
export const on: EventBus['on'] = (...args) => getEventBus().on(...args);
export const once: EventBus['once'] = (...args) => getEventBus().once(...args);

// ============================================
// Debug Helper (dev only)
// ============================================

export const debugEventBus = (): void => {
  if (import.meta.env.DEV) {
    const bus = getEventBus();
    const originalEmit = bus.emit.bind(bus);

    bus.emit = ((type: EventType, payload: unknown) => {
      console.log(`[EventBus] ${type}`, payload);
      return originalEmit(type, payload as never);
    }) as typeof bus.emit;
  }
};
