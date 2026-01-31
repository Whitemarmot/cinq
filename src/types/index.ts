/**
 * CINQ Type Definitions
 * Shared types across the application
 */

// ============================================
// User & Auth
// ============================================

export interface User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
}

export interface AuthSession {
  readonly user: User;
  readonly accessToken: string;
  readonly expiresAt: number;
}

export type AuthState = 
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: AuthSession };

// ============================================
// Contacts
// ============================================

export interface Contact {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly addedAt: string;
}

export interface ContactsState {
  readonly contacts: readonly Contact[];
  readonly count: number;
  readonly limit: 5;
  readonly remaining: number;
}

export const MAX_CONTACTS = 5 as const;

// ============================================
// Messages
// ============================================

export interface Message {
  readonly id: string;
  readonly senderId: string;
  readonly receiverId: string;
  readonly content: string;
  readonly isPing: boolean;
  readonly isMine: boolean;
  readonly createdAt: string;
}

export interface MessagesState {
  readonly messages: readonly Message[];
  readonly contactId: string;
  readonly loading: boolean;
}

// ============================================
// API Responses
// ============================================

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiError {
  readonly success: false;
  readonly error: string;
  readonly code?: ErrorCode;
  readonly details?: Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================
// Error Codes
// ============================================

export type ErrorCode =
  | 'SELF_ADD'
  | 'USER_NOT_FOUND'
  | 'ALREADY_CONTACT'
  | 'LIMIT_REACHED'
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'SERVER_ERROR';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  SELF_ADD: "Tu ne peux pas t'ajouter toi-même 😅",
  USER_NOT_FOUND: "Cette personne n'est pas encore sur Cinq. Offre-lui un accès ! 🎁",
  ALREADY_CONTACT: "Cette personne est déjà dans ton cercle",
  LIMIT_REACHED: "5 contacts max. C'est le concept ! 🎯",
  UNAUTHORIZED: "Session expirée. Reconnecte-toi.",
  INVALID_INPUT: "Données invalides",
  NOT_FOUND: "Ressource non trouvée",
  SERVER_ERROR: "Erreur serveur. Réessaie !",
} as const;

// ============================================
// Events
// ============================================

export type AppEvent =
  | { type: 'AUTH_STATE_CHANGED'; payload: AuthState }
  | { type: 'CONTACTS_UPDATED'; payload: ContactsState }
  | { type: 'MESSAGE_RECEIVED'; payload: Message }
  | { type: 'MESSAGE_SENT'; payload: Message }
  | { type: 'CONTACT_SELECTED'; payload: Contact | null }
  | { type: 'TOAST'; payload: ToastPayload }
  | { type: 'CONFETTI'; payload?: ConfettiOptions };

export interface ToastPayload {
  readonly message: string;
  readonly duration?: number;
  readonly type?: 'info' | 'success' | 'error';
}

export interface ConfettiOptions {
  readonly particleCount?: number;
  readonly spread?: number;
  readonly colors?: readonly string[];
}

// ============================================
// Utility Types
// ============================================

export type Listener<T> = (event: T) => void;
export type Unsubscribe = () => void;

export interface Subscribable<T> {
  subscribe(listener: Listener<T>): Unsubscribe;
}
