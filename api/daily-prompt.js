/**
 * Daily Prompt API - Suggestion quotidienne pour encourager l'engagement
 * 
 * Endpoints:
 * - GET / - Get today's prompt
 * - GET ?history=true - Get last 7 days of prompts
 */

import { handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError } from './_error-logger.js';

// Collection de prompts pour encourager l'engagement
// Organisés par catégories pour varier les sujets
const PROMPTS = [
    // Souvenirs & Nostalgie
    { emoji: '📸', text: 'Partage une photo de ton enfance préférée', category: 'memories' },
    { emoji: '🎵', text: 'Quelle chanson te rappelle un souvenir particulier ?', category: 'memories' },
    { emoji: '🏠', text: 'Décris l\'endroit où tu as grandi en 3 mots', category: 'memories' },
    { emoji: '👨‍👩‍👧', text: 'Raconte un souvenir avec tes grands-parents', category: 'memories' },
    { emoji: '🎮', text: 'Quel jeu de ton enfance te manque le plus ?', category: 'memories' },
    
    // Gratitude & Positif
    { emoji: '🙏', text: 'Pour quoi es-tu reconnaissant(e) aujourd\'hui ?', category: 'gratitude' },
    { emoji: '✨', text: 'Quel petit bonheur as-tu vécu cette semaine ?', category: 'gratitude' },
    { emoji: '💪', text: 'De quoi es-tu fier(e) récemment ?', category: 'gratitude' },
    { emoji: '🌈', text: 'Qui t\'a fait sourire cette semaine ?', category: 'gratitude' },
    { emoji: '💝', text: 'Quel compliment as-tu reçu qui t\'a marqué ?', category: 'gratitude' },
    
    // Questions légères
    { emoji: '🍕', text: 'Pizza ou burger ? Défends ton choix !', category: 'fun' },
    { emoji: '🌙', text: 'Es-tu plutôt du matin ou du soir ?', category: 'fun' },
    { emoji: '🎬', text: 'Quel film pourrais-tu revoir 100 fois ?', category: 'fun' },
    { emoji: '📚', text: 'Quel livre a changé ta façon de voir les choses ?', category: 'fun' },
    { emoji: '🎤', text: 'Si tu devais chanter une chanson au karaoké, laquelle ?', category: 'fun' },
    { emoji: '🏝️', text: 'Destination de rêve : plage ou montagne ?', category: 'fun' },
    { emoji: '🍿', text: 'Série que tu as bingé récemment ?', category: 'fun' },
    
    // Réflexion personnelle
    { emoji: '💭', text: 'Quel conseil donnerais-tu à ton moi de 16 ans ?', category: 'reflection' },
    { emoji: '🎯', text: 'Quel petit objectif veux-tu atteindre ce mois-ci ?', category: 'reflection' },
    { emoji: '🔮', text: 'Où te vois-tu dans 5 ans ?', category: 'reflection' },
    { emoji: '💡', text: 'Quelle habitude veux-tu changer ?', category: 'reflection' },
    { emoji: '🌱', text: 'Qu\'est-ce qui t\'inspire en ce moment ?', category: 'reflection' },
    
    // Connexion avec les autres
    { emoji: '👋', text: 'Comment as-tu rencontré ton/ta meilleur(e) ami(e) ?', category: 'connection' },
    { emoji: '❤️', text: 'Quel trait de caractère admires-tu chez un proche ?', category: 'connection' },
    { emoji: '🤝', text: 'Quelle personne aimerais-tu remercier aujourd\'hui ?', category: 'connection' },
    { emoji: '💌', text: 'Si tu devais écrire une lettre à quelqu\'un, à qui ?', category: 'connection' },
    { emoji: '🎁', text: 'Quel est le plus beau cadeau qu\'on t\'ait fait ?', category: 'connection' },
    
    // Découvertes & Recommandations
    { emoji: '🎧', text: 'Recommande un podcast à tes 5 !', category: 'discovery' },
    { emoji: '📱', text: 'Une app que tu utilises tous les jours ?', category: 'discovery' },
    { emoji: '🍳', text: 'Partage une recette rapide que tu adores', category: 'discovery' },
    { emoji: '🎨', text: 'Quel artiste as-tu découvert récemment ?', category: 'discovery' },
    { emoji: '☕', text: 'Ton café/thé préféré, c\'est quoi ?', category: 'discovery' },
    
    // Actualité personnelle
    { emoji: '📅', text: 'Qu\'as-tu prévu ce week-end ?', category: 'updates' },
    { emoji: '🎉', text: 'Une bonne nouvelle à partager ?', category: 'updates' },
    { emoji: '🏃', text: 'Quel défi te lances-tu cette semaine ?', category: 'updates' },
    { emoji: '🌤️', text: 'Comment te sens-tu aujourd\'hui en un emoji ?', category: 'updates' },
    { emoji: '📝', text: 'Qu\'as-tu appris de nouveau récemment ?', category: 'updates' },
    
    // Créativité
    { emoji: '✍️', text: 'Écris un haiku sur ta journée', category: 'creative' },
    { emoji: '🖼️', text: 'Décris ce que tu vois par ta fenêtre', category: 'creative' },
    { emoji: '🎭', text: 'Si ta vie était un film, quel serait le titre ?', category: 'creative' },
    { emoji: '🌟', text: 'Invente un super-pouvoir que tu aimerais avoir', category: 'creative' },
    { emoji: '📻', text: 'Quelle serait la bande-son de ta vie ?', category: 'creative' },
];

// Prompts spéciaux pour certains jours
const SPECIAL_PROMPTS = {
    // Lundi - motivation
    1: { emoji: '🚀', text: 'C\'est lundi ! Quel est ton objectif pour cette semaine ?', category: 'special' },
    // Vendredi - célébration
    5: { emoji: '🎉', text: 'Vendredi ! Qu\'est-ce qui t\'a rendu heureux(se) cette semaine ?', category: 'special' },
    // Dimanche - réflexion
    0: { emoji: '🌅', text: 'Dimanche détente. Comment recharges-tu tes batteries ?', category: 'special' },
};

/**
 * Génère un index déterministe basé sur la date
 * Utilise un simple hash pour éviter la répétition prévisible
 */
function getDailyPromptIndex(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Simple hash combinant année, mois et jour
    const seed = year * 10000 + month * 100 + day;
    
    // Mix le seed pour une meilleure distribution
    let hash = seed;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = (hash >> 16) ^ hash;
    
    return Math.abs(hash) % PROMPTS.length;
}

/**
 * Récupère le prompt du jour
 */
function getTodayPrompt(date = new Date()) {
    const dayOfWeek = date.getDay();
    
    // Vérifie s'il y a un prompt spécial pour ce jour de la semaine
    if (SPECIAL_PROMPTS[dayOfWeek] && Math.random() < 0.5) {
        return {
            ...SPECIAL_PROMPTS[dayOfWeek],
            isSpecial: true,
            date: date.toISOString().split('T')[0],
        };
    }
    
    // Sinon, utilise le prompt normal du jour
    const index = getDailyPromptIndex(date);
    return {
        ...PROMPTS[index],
        isSpecial: false,
        date: date.toISOString().split('T')[0],
    };
}

/**
 * Récupère l'historique des prompts (7 derniers jours)
 */
function getPromptHistory(days = 7) {
    const history = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        history.push(getTodayPrompt(date));
    }
    
    return history;
}

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    // Rate limiting (lecture, assez permissif)
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'daily-prompt' })) {
        return;
    }

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { history } = req.query;
        
        if (history === 'true') {
            // Retourne l'historique des 7 derniers jours
            const prompts = getPromptHistory(7);
            return res.json({
                success: true,
                prompts,
            });
        }
        
        // Retourne le prompt du jour
        const prompt = getTodayPrompt();
        
        return res.json({
            success: true,
            prompt,
        });

    } catch (e) {
        logError(e, {
            endpoint: '/api/daily-prompt',
            method: req.method,
        });
        return res.status(500).json({
            error: 'Erreur lors de la récupération du prompt',
            hint: 'Réessaie dans quelques instants',
        });
    }
}
