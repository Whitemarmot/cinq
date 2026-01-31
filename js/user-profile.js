/**
 * 🔧 CINQ User Profile Module
 * Gestion du profil utilisateur, notifications, et compte
 */

const UserProfile = (function() {
    'use strict';
    
    // ========================================
    // Configuration
    // ========================================
    const API_BASE = '/.netlify/functions';
    const SUPABASE_URL = 'https://guioxfulihyehrwytxce.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aW94ZnVsaWh5ZWhyd3l0eGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDg5NjUsImV4cCI6MjA4NTM4NDk2NX0.pLvhH3dEYGH7EQCFxUwtvhscLamKVnsWRNnrT412YHQ';
    
    // État interne
    let _supabase = null;
    let _currentUser = null;
    let _profile = null;
    let _preferences = {
        notifications: {
            newMessage: true,
            ping: true,
            newContact: true,
            email: false
        }
    };
    
    // ========================================
    // Initialisation Supabase
    // ========================================
    function initSupabase() {
        if (_supabase) return _supabase;
        
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return _supabase;
    }
    
    // ========================================
    // Utilitaires
    // ========================================
    
    async function getAccessToken() {
        const db = initSupabase();
        if (!db) return null;
        
        const { data: { session } } = await db.auth.getSession();
        return session?.access_token || null;
    }
    
    async function apiCall(endpoint, method = 'GET', body = null) {
        const token = await getAccessToken();
        
        if (!token) {
            throw new Error('Non authentifié');
        }
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        
        const res = await fetch(`${API_BASE}/${endpoint}`, options);
        const data = await res.json();
        
        if (!res.ok || !data.success) {
            const err = new Error(data.error || 'Erreur API');
            err.code = data.details?.code;
            err.status = res.status;
            throw err;
        }
        
        return data;
    }
    
    function getEmailPrefix(email) {
        return email ? email.split('@')[0] : '';
    }
    
    // ========================================
    // Authentification
    // ========================================
    
    async function getCurrentUser() {
        const db = initSupabase();
        if (!db) return null;
        
        const { data: { user } } = await db.auth.getUser();
        _currentUser = user;
        return user;
    }
    
    async function checkAuth() {
        const db = initSupabase();
        if (!db) return null;
        
        const { data: { session } } = await db.auth.getSession();
        
        if (session?.user) {
            _currentUser = session.user;
            return session.user;
        }
        
        return null;
    }
    
    async function logout() {
        const db = initSupabase();
        if (!db) throw new Error('Supabase non initialisé');
        
        await db.auth.signOut();
        _currentUser = null;
        _profile = null;
        
        window.location.href = '/login';
    }
    
    // ========================================
    // Profil
    // ========================================
    
    async function loadProfile() {
        try {
            const data = await apiCall('profile');
            _profile = data.profile || {};
            return _profile;
        } catch (err) {
            console.error('Erreur chargement profil:', err);
            // Retourner profil basique depuis user
            if (_currentUser) {
                return {
                    email: _currentUser.email,
                    display_name: getEmailPrefix(_currentUser.email),
                    created_at: _currentUser.created_at
                };
            }
            throw err;
        }
    }
    
    async function updateProfile(updates) {
        const validFields = ['display_name'];
        const filteredUpdates = {};
        
        for (const key of validFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('Aucune modification');
        }
        
        const data = await apiCall('profile', 'PATCH', filteredUpdates);
        _profile = { ..._profile, ...filteredUpdates };
        return data;
    }
    
    async function updateEmail(newEmail) {
        const db = initSupabase();
        if (!db) throw new Error('Supabase non initialisé');
        
        const { error } = await db.auth.updateUser({ email: newEmail });
        
        if (error) {
            throw new Error(error.message);
        }
        
        return { success: true, message: 'Un email de confirmation a été envoyé' };
    }
    
    async function updatePassword(currentPassword, newPassword) {
        const db = initSupabase();
        if (!db) throw new Error('Supabase non initialisé');
        
        // Vérifier le mot de passe actuel en se reconnectant
        const { error: signInError } = await db.auth.signInWithPassword({
            email: _currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            throw new Error('Mot de passe actuel incorrect');
        }
        
        // Mettre à jour le mot de passe
        const { error } = await db.auth.updateUser({ password: newPassword });
        
        if (error) {
            throw new Error(error.message);
        }
        
        return { success: true };
    }
    
    // ========================================
    // Préférences & Notifications
    // ========================================
    
    async function loadPreferences() {
        try {
            const data = await apiCall('preferences');
            _preferences = data.preferences || _preferences;
            return _preferences;
        } catch (err) {
            // Utiliser les préférences par défaut si l'API n'existe pas
            console.warn('Préférences non disponibles, utilisation des valeurs par défaut');
            return _preferences;
        }
    }
    
    async function updatePreferences(updates) {
        try {
            const data = await apiCall('preferences', 'PATCH', updates);
            _preferences = { ..._preferences, ...updates };
            return data;
        } catch (err) {
            // Stocker localement si l'API n'existe pas
            _preferences = { ..._preferences, ...updates };
            localStorage.setItem('cinq_preferences', JSON.stringify(_preferences));
            return { success: true, local: true };
        }
    }
    
    function getPreferences() {
        // Essayer de charger depuis localStorage si pas déjà chargé
        if (!_preferences.loaded) {
            const stored = localStorage.getItem('cinq_preferences');
            if (stored) {
                try {
                    _preferences = { ...JSON.parse(stored), loaded: true };
                } catch (e) {
                    // Ignorer
                }
            }
        }
        return _preferences;
    }
    
    // ========================================
    // Suppression de compte
    // ========================================
    
    async function deleteAccount(confirmation) {
        if (confirmation !== 'SUPPRIMER') {
            throw new Error('Confirmation invalide');
        }
        
        try {
            await apiCall('account', 'DELETE', { confirmation });
            
            // Déconnexion locale
            const db = initSupabase();
            if (db) {
                await db.auth.signOut();
            }
            
            _currentUser = null;
            _profile = null;
            
            return { success: true };
        } catch (err) {
            throw new Error(err.message || 'Erreur lors de la suppression du compte');
        }
    }
    
    // ========================================
    // Statistiques
    // ========================================
    
    async function getStats() {
        try {
            const data = await apiCall('stats');
            return data.stats || {};
        } catch (err) {
            console.warn('Stats non disponibles');
            return {
                contacts_count: 0,
                messages_sent: 0,
                pings_sent: 0,
                member_since: _currentUser?.created_at
            };
        }
    }
    
    // ========================================
    // API Publique
    // ========================================
    return {
        // Init
        init: initSupabase,
        
        // Auth
        checkAuth,
        getCurrentUser,
        logout,
        
        // Profile
        loadProfile,
        updateProfile,
        updateEmail,
        updatePassword,
        
        // Preferences
        loadPreferences,
        updatePreferences,
        getPreferences,
        
        // Account
        deleteAccount,
        
        // Stats
        getStats,
        
        // Helpers
        getEmailPrefix,
        
        // State getters
        get user() { return _currentUser; },
        get profile() { return _profile; },
        get preferences() { return _preferences; }
    };
    
})();

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfile;
}
