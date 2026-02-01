/**
 * ==========================================================================
 * CINQ - Lightweight Markdown Parser
 * ==========================================================================
 * 
 * Parses basic Markdown syntax without any external dependencies.
 * Designed to work safely with pre-escaped HTML content.
 * 
 * Supported syntax:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - `inline code`
 * - [link text](url)
 * 
 * Security: This module expects pre-escaped HTML input (via escapeHtml).
 * It will NOT re-escape content, allowing Markdown to produce safe HTML.
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

(function(window) {

  /**
   * Parse basic Markdown syntax and return HTML
   * 
   * IMPORTANT: Input should already be HTML-escaped to prevent XSS.
   * This function converts Markdown syntax to HTML elements.
   * 
   * @param {string} text - Pre-escaped text with Markdown syntax
   * @returns {string} - HTML string with Markdown converted
   * 
   * @example
   * // Input should be pre-escaped:
   * const safe = escapeHtml(userInput);
   * const html = parseMarkdown(safe);
   * 
   * // Examples:
   * parseMarkdown('**bold** text')           // '<strong>bold</strong> text'
   * parseMarkdown('*italic* text')           // '<em>italic</em> text'
   * parseMarkdown('`code` here')             // '<code>code</code> here'
   * parseMarkdown('[link](https://x.com)')   // '<a href="https://x.com" ...>link</a>'
   */
  function parseMarkdown(text) {
    if (!text || typeof text !== 'string') return text || '';

    let result = text;

    // Order matters! Process in correct order to avoid conflicts.

    // 1. Links: [text](url)
    // Only allow http/https URLs for security
    result = result.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
    );

    // 2. Bold: **text** or __text__
    // Must process before italic to handle ** vs *
    result = result.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="md-bold">$1</strong>'
    );
    result = result.replace(
      /__([^_]+)__/g,
      '<strong class="md-bold">$1</strong>'
    );

    // 3. Italic: *text* or _text_
    // Use negative lookbehind/lookahead to avoid matching inside words (e.g., some_var_name)
    // Simple approach: match *text* where text doesn't contain * and isn't empty
    result = result.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em class="md-italic">$1</em>'
    );
    // For underscores, be more careful to avoid matching snake_case
    // Only match _text_ when surrounded by whitespace or at start/end
    result = result.replace(
      /(?:^|[\s>])_([^_\n]+)_(?:$|[\s<.,!?;:])/g,
      (match, p1) => match.replace(`_${p1}_`, `<em class="md-italic">${p1}</em>`)
    );

    // 4. Inline code: `code`
    result = result.replace(
      /`([^`\n]+)`/g,
      '<code class="md-code">$1</code>'
    );

    return result;
  }

  /**
   * Check if text contains any Markdown syntax
   * Useful for conditional parsing or preview indicators
   * 
   * @param {string} text - Text to check
   * @returns {boolean} - True if Markdown syntax detected
   */
  function hasMarkdown(text) {
    if (!text) return false;
    
    // Check for any Markdown patterns
    const patterns = [
      /\*\*[^*]+\*\*/,        // **bold**
      /__[^_]+__/,            // __bold__
      /(?<!\*)\*[^*\n]+\*(?!\*)/, // *italic*
      /(?:^|[\s>])_[^_\n]+_(?:$|[\s<.,!?;:])/, // _italic_
      /`[^`\n]+`/,            // `code`
      /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/ // [link](url)
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Strip Markdown syntax from text (for plain text extraction)
   * Useful for notifications, previews, etc.
   * 
   * @param {string} text - Text with Markdown syntax
   * @returns {string} - Plain text without Markdown
   */
  function stripMarkdown(text) {
    if (!text) return '';
    
    return text
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bold markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Remove italic markers
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove code markers
      .replace(/`([^`]+)`/g, '$1');
  }

  /**
   * Escape Markdown special characters
   * Useful when you want to display literal *, _, etc.
   * 
   * @param {string} text - Text to escape
   * @returns {string} - Text with Markdown chars escaped
   */
  function escapeMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Combined helper: escape HTML, then parse Markdown
   * Convenience function for common use case
   * 
   * @param {string} text - Raw user input
   * @returns {string} - Safe HTML with Markdown formatting
   */
  function renderMarkdown(text) {
    if (!text) return '';
    
    // First escape HTML for XSS prevention
    const escaped = window.escapeHtml ? window.escapeHtml(text) : text;
    
    // Then parse Markdown
    return parseMarkdown(escaped);
  }

  // ============================================
  // Export to Global Scope
  // ============================================

  // Export functions globally
  window.parseMarkdown = parseMarkdown;
  window.hasMarkdown = hasMarkdown;
  window.stripMarkdown = stripMarkdown;
  window.escapeMarkdown = escapeMarkdown;
  window.renderMarkdown = renderMarkdown;

  // Also expose under CinqMarkdown namespace
  window.CinqMarkdown = {
    parse: parseMarkdown,
    has: hasMarkdown,
    strip: stripMarkdown,
    escape: escapeMarkdown,
    render: renderMarkdown
  };

  // Add to CinqShared if it exists
  if (window.CinqShared) {
    window.CinqShared.parseMarkdown = parseMarkdown;
    window.CinqShared.renderMarkdown = renderMarkdown;
    window.CinqShared.hasMarkdown = hasMarkdown;
    window.CinqShared.stripMarkdown = stripMarkdown;
  }

})(window);
