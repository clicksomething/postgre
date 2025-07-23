// Translation service using LibreTranslate (free) with fallback mappings
const axios = require('axios');

// LibreTranslate configuration
const LIBRE_TRANSLATE_URL = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de/translate';
const LIBRE_TRANSLATE_API_KEY = process.env.LIBRE_TRANSLATE_API_KEY; // Optional for some instances

// Fallback translation mappings for common Arabic terms
const fallbackTranslations = {
    // Common academic titles
    'دكتور': 'Dr.',
    'دكتورة': 'Dr.',
    'أستاذ': 'Prof.',
    'أستاذة': 'Prof.',
    'مهندس': 'Eng.',
    'مهندسة': 'Eng.',
    
    // Common academic ranks
    'مدرس': 'Lecturer',
    'مدرس مساعد': 'Assistant Lecturer',
    'أستاذ مساعد': 'Assistant Professor',
    'أستاذ مشارك': 'Associate Professor',
    'محاضر': 'Lecturer',
    'محاضر مساعد': 'Assistant Lecturer',
    
    // Common availability terms
    'جزئي': 'part-time',
    'كامل': 'full-time',
    'متفرغ': 'full-time',
    'غير متفرغ': 'part-time',
    
    // Common day names
    'السبت': 'Saturday',
    'الأحد': 'Sunday',
    'الإثنين': 'Monday',
    'الثلاثاء': 'Tuesday',
    'الأربعاء': 'Wednesday',
    'الخميس': 'Thursday',
    'الجمعة': 'Friday'
};

/**
 * Translate text using LibreTranslate with fallback to local mappings
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language (default: 'ar')
 * @param {string} targetLanguage - Target language (default: 'en')
 * @returns {Promise<string>} Translated text or original if translation fails
 */
const translateText = async (text, sourceLanguage = 'ar', targetLanguage = 'en') => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Check fallback translations first
    const normalizedText = text.trim();
    const normalizedWithoutAl = normalizedText.replace(/^ال\s*/, '').trim();
    
    if (fallbackTranslations[normalizedText]) {
        console.log(`Fallback translation: "${normalizedText}" -> "${fallbackTranslations[normalizedText]}"`);
        return fallbackTranslations[normalizedText];
    }
    
    if (fallbackTranslations[normalizedWithoutAl]) {
        console.log(`Fallback translation: "${normalizedWithoutAl}" -> "${fallbackTranslations[normalizedWithoutAl]}"`);
        return fallbackTranslations[normalizedWithoutAl];
    }

    // Try LibreTranslate
    try {
        console.log(`Attempting LibreTranslate for: "${text}"`);
        
        const response = await axios.post(LIBRE_TRANSLATE_URL, {
            q: text,
            source: sourceLanguage,
            target: targetLanguage,
            api_key: LIBRE_TRANSLATE_API_KEY // Optional
        }, {
            timeout: 5000, // 5 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.translatedText) {
            console.log(`LibreTranslate: "${text}" -> "${response.data.translatedText}"`);
            return response.data.translatedText;
        }
    } catch (error) {
        console.warn(`LibreTranslate failed for "${text}":`, error.message);
    }
    
    console.log(`No translation found for: "${text}", returning original`);
    return text;
};

/**
 * Smart translation with fallback logic
 * @param {string} text - Text to translate
 * @param {Object} mappings - Existing mappings to check first
 * @param {string} context - Context for better translation (e.g., 'title', 'rank')
 * @returns {Promise<string>} Translated or mapped text
 */
const smartTranslate = async (text, mappings = {}, context = '') => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    const normalizedText = text.trim();
    
    // First, check if we have an exact mapping
    if (mappings[normalizedText]) {
        return mappings[normalizedText];
    }

    // Check for normalized mappings (without leading "ال")
    const normalizedWithoutAl = normalizedText.replace(/^ال\s*/, '').trim();
    if (mappings[normalizedWithoutAl]) {
        return mappings[normalizedWithoutAl];
    }

    // Check fallback translations
    if (fallbackTranslations[normalizedText]) {
        console.log(`Using fallback translation: "${normalizedText}" -> "${fallbackTranslations[normalizedText]}"`);
        return fallbackTranslations[normalizedText];
    }

    if (fallbackTranslations[normalizedWithoutAl]) {
        console.log(`Using fallback translation: "${normalizedWithoutAl}" -> "${fallbackTranslations[normalizedWithoutAl]}"`);
        return fallbackTranslations[normalizedWithoutAl];
    }

    // If no mapping found, try LibreTranslate
    console.log(`No mapping found for "${normalizedText}", attempting LibreTranslate...`);
    const translated = await translateText(normalizedText);
    
    // Post-process translation based on context
    return postProcessTranslation(translated, context);
};

/**
 * Post-process translated text based on context
 * @param {string} translatedText - Translated text
 * @param {string} context - Context (title, rank, etc.)
 * @returns {string} Post-processed text
 */
const postProcessTranslation = (translatedText, context) => {
    if (!translatedText) return translatedText;

    let processed = translatedText.trim();

    // Context-specific processing
    switch (context) {
        case 'title':
            // Ensure titles start with proper prefixes
            if (processed.toLowerCase().includes('doctor') || processed.toLowerCase().includes('dr')) {
                return 'Dr.';
            } else if (processed.toLowerCase().includes('professor') || processed.toLowerCase().includes('prof')) {
                return 'Prof.';
            } else if (processed.toLowerCase().includes('engineer') || processed.toLowerCase().includes('eng')) {
                return 'Eng.';
            }
            break;
            
        case 'rank':
            // Standardize academic ranks
            const rankMappings = {
                'lecturer': 'Lecturer',
                'assistant lecturer': 'Assistant Lecturer',
                'assistant professor': 'Assistant Professor',
                'associate professor': 'Associate Professor',
                'professor': 'Professor',
                'teaching assistant': 'Teaching Assistant',
                'research assistant': 'Research Assistant'
            };
            
            const lowerProcessed = processed.toLowerCase();
            for (const [key, value] of Object.entries(rankMappings)) {
                if (lowerProcessed.includes(key)) {
                    return value;
                }
            }
            break;
            
        case 'availability':
            // Standardize availability terms
            if (processed.toLowerCase().includes('full') || processed.toLowerCase().includes('complete')) {
                return 'full-time';
            } else if (processed.toLowerCase().includes('part') || processed.toLowerCase().includes('partial')) {
                return 'part-time';
            }
            break;
    }

    return processed;
};

module.exports = {
    translateText,
    smartTranslate,
    postProcessTranslation
}; 