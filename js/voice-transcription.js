/**
 * ==========================================================================
 * CINQ - Voice Transcription Module
 * ==========================================================================
 * 
 * Automatic transcription of voice messages using Web Speech API.
 * Transcribes audio in real-time during recording.
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

const CinqVoiceTranscription = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const CONFIG = {
        // Languages to try (in order of preference)
        languages: ['fr-FR', 'en-US', 'es-ES', 'de-DE'],
        // Show transcription UI
        showTranscript: true,
        // Continuous recognition during recording
        continuous: true,
        // Return interim results
        interimResults: true,
        // Max alternatives
        maxAlternatives: 1
    };
    
    // ============================================
    // State
    // ============================================
    
    /** @type {SpeechRecognition|null} */
    let recognition = null;
    
    /** @type {boolean} */
    let isSupported = false;
    
    /** @type {boolean} */
    let isRecognizing = false;
    
    /** @type {string} */
    let currentTranscript = '';
    
    /** @type {string} */
    let interimTranscript = '';
    
    /** @type {Function|null} */
    let onTranscriptUpdate = null;
    
    /** @type {Function|null} */
    let onTranscriptFinal = null;
    
    // ============================================
    // Initialization
    // ============================================
    
    /**
     * Check if Web Speech API is supported
     * @returns {boolean}
     */
    function checkSupport() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        isSupported = !!SpeechRecognition;
        
        if (!isSupported) {
            console.warn('[VoiceTranscription] Web Speech API not supported in this browser');
        }
        
        return isSupported;
    }
    
    /**
     * Initialize the speech recognition instance
     * @param {Object} options - Configuration options
     * @returns {boolean} Success
     */
    function init(options = {}) {
        if (!checkSupport()) {
            return false;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Apply configuration
        recognition.continuous = options.continuous ?? CONFIG.continuous;
        recognition.interimResults = options.interimResults ?? CONFIG.interimResults;
        recognition.maxAlternatives = options.maxAlternatives ?? CONFIG.maxAlternatives;
        recognition.lang = options.lang || CONFIG.languages[0];
        
        // Set up event handlers
        recognition.onstart = handleRecognitionStart;
        recognition.onend = handleRecognitionEnd;
        recognition.onresult = handleRecognitionResult;
        recognition.onerror = handleRecognitionError;
        recognition.onnomatch = handleNoMatch;
        
        console.log('[VoiceTranscription] Initialized with language:', recognition.lang);
        return true;
    }
    
    // ============================================
    // Event Handlers
    // ============================================
    
    function handleRecognitionStart() {
        isRecognizing = true;
        console.log('[VoiceTranscription] Recognition started');
    }
    
    function handleRecognitionEnd() {
        isRecognizing = false;
        console.log('[VoiceTranscription] Recognition ended');
        
        // Call final callback with complete transcript
        if (onTranscriptFinal && currentTranscript) {
            onTranscriptFinal(currentTranscript.trim());
        }
    }
    
    function handleRecognitionResult(event) {
        interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                currentTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Notify listener of update
        if (onTranscriptUpdate) {
            onTranscriptUpdate({
                final: currentTranscript.trim(),
                interim: interimTranscript,
                combined: (currentTranscript + interimTranscript).trim()
            });
        }
    }
    
    function handleRecognitionError(event) {
        console.warn('[VoiceTranscription] Error:', event.error);
        
        // Handle specific errors
        switch (event.error) {
            case 'no-speech':
                // User didn't say anything - not really an error
                break;
            case 'audio-capture':
                console.error('[VoiceTranscription] No microphone detected');
                break;
            case 'not-allowed':
                console.error('[VoiceTranscription] Microphone permission denied');
                break;
            case 'network':
                console.error('[VoiceTranscription] Network error');
                break;
            case 'aborted':
                // Recognition was aborted - normal when stopping
                break;
            default:
                console.error('[VoiceTranscription] Unknown error:', event.error);
        }
    }
    
    function handleNoMatch() {
        console.log('[VoiceTranscription] No speech recognized');
    }
    
    // ============================================
    // Public API
    // ============================================
    
    /**
     * Start speech recognition
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onUpdate - Called on transcript updates
     * @param {Function} callbacks.onFinal - Called when recognition ends
     * @returns {boolean} Success
     */
    function start(callbacks = {}) {
        if (!isSupported) {
            if (!init()) {
                return false;
            }
        }
        
        if (isRecognizing) {
            console.warn('[VoiceTranscription] Already recognizing');
            return true;
        }
        
        // Reset state
        currentTranscript = '';
        interimTranscript = '';
        
        // Set callbacks
        onTranscriptUpdate = callbacks.onUpdate || null;
        onTranscriptFinal = callbacks.onFinal || null;
        
        try {
            recognition.start();
            return true;
        } catch (e) {
            console.error('[VoiceTranscription] Failed to start:', e);
            
            // Try to reinitialize
            if (init()) {
                try {
                    recognition.start();
                    return true;
                } catch (e2) {
                    console.error('[VoiceTranscription] Retry failed:', e2);
                }
            }
            
            return false;
        }
    }
    
    /**
     * Stop speech recognition
     * @returns {string} Final transcript
     */
    function stop() {
        if (!recognition || !isRecognizing) {
            return currentTranscript.trim();
        }
        
        try {
            recognition.stop();
        } catch (e) {
            console.error('[VoiceTranscription] Failed to stop:', e);
        }
        
        return currentTranscript.trim();
    }
    
    /**
     * Abort speech recognition without final callback
     */
    function abort() {
        if (!recognition) return;
        
        onTranscriptFinal = null; // Don't call final callback
        
        try {
            recognition.abort();
        } catch (e) {
            console.error('[VoiceTranscription] Failed to abort:', e);
        }
        
        currentTranscript = '';
        interimTranscript = '';
    }
    
    /**
     * Get current transcript
     * @returns {Object} Transcript data
     */
    function getTranscript() {
        return {
            final: currentTranscript.trim(),
            interim: interimTranscript,
            combined: (currentTranscript + interimTranscript).trim(),
            isRecognizing: isRecognizing
        };
    }
    
    /**
     * Set recognition language
     * @param {string} lang - Language code (e.g., 'fr-FR')
     */
    function setLanguage(lang) {
        if (recognition) {
            recognition.lang = lang;
        }
    }
    
    /**
     * Check if transcription is supported
     * @returns {boolean}
     */
    function isTranscriptionSupported() {
        if (!isSupported) {
            checkSupport();
        }
        return isSupported;
    }
    
    // ============================================
    // UI Helpers
    // ============================================
    
    /**
     * Create transcription preview element
     * @param {string} transcript - Current transcript text
     * @param {boolean} isInterim - Whether this is interim text
     * @returns {HTMLElement}
     */
    function createTranscriptPreview(transcript, isInterim = false) {
        const el = document.createElement('div');
        el.className = 'voice-transcript-preview' + (isInterim ? ' interim' : '');
        el.innerHTML = `
            <span class="voice-transcript-icon">📝</span>
            <span class="voice-transcript-text">${escapeHtml(transcript) || '<em>En écoute...</em>'}</span>
        `;
        return el;
    }
    
    /**
     * Render transcript display for a voice message
     * @param {string} transcript - Transcript text
     * @param {string} msgId - Message ID
     * @returns {string} HTML string
     */
    function renderTranscriptDisplay(transcript, msgId) {
        if (!transcript) return '';
        
        return `
            <div class="voice-transcript" id="voice-transcript-${msgId}">
                <button class="voice-transcript-toggle" onclick="CinqVoiceTranscription.toggleTranscript('${msgId}')" type="button" aria-expanded="false" aria-controls="voice-transcript-text-${msgId}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span>Transcription</span>
                    <svg class="voice-transcript-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="voice-transcript-content" id="voice-transcript-text-${msgId}">
                    <p>${escapeHtml(transcript)}</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Toggle transcript visibility
     * @param {string} msgId - Message ID
     */
    function toggleTranscript(msgId) {
        const container = document.getElementById(`voice-transcript-${msgId}`);
        const content = document.getElementById(`voice-transcript-text-${msgId}`);
        const toggle = container?.querySelector('.voice-transcript-toggle');
        
        if (!container || !content || !toggle) return;
        
        const isExpanded = container.classList.contains('expanded');
        
        container.classList.toggle('expanded', !isExpanded);
        toggle.setAttribute('aria-expanded', !isExpanded);
        
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('tap');
        }
    }
    
    // ============================================
    // Utility Functions
    // ============================================
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ============================================
    // Module Export
    // ============================================
    
    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => checkSupport());
    } else {
        checkSupport();
    }
    
    return {
        // Core API
        init,
        start,
        stop,
        abort,
        getTranscript,
        setLanguage,
        isSupported: isTranscriptionSupported,
        
        // UI Helpers
        renderTranscriptDisplay,
        toggleTranscript,
        createTranscriptPreview,
        
        // State
        get isRecognizing() { return isRecognizing; }
    };
    
})();

// Export to window
window.CinqVoiceTranscription = CinqVoiceTranscription;
