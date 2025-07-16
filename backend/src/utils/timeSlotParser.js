const moment = require('moment');

// Utility function to normalize Arabic numerals to English
const normalizeArabicNumerals = (str) => {
    const arabicToEnglishMap = {
        '٠': '0', '٩': '9', '٨': '8', '٧': '7', '٦': '6', 
        '٥': '5', '٤': '4', '٣': '3', '٢': '2', '١': '1'
    };
    return str.split('').map(char => arabicToEnglishMap[char] || char).join('');
};

// Utility function to parse Arabic time phrases
const parseArabicTimePhrase = (phrase) => {
    // Remove Arabic words and normalize
    const cleanedPhrase = phrase
        .replace(/من الساعة/g, '')
        .replace(/ولغاية/g, '-')
        .trim();
    
    return cleanedPhrase;
};

// Main time slot parsing function
const parseTimeSlot = (timeValue, defaultStartTime = '08:00', defaultEndTime = '16:30') => {
    // Check for full day availability (√, /, o)
    if (timeValue === '√' || timeValue === '/' || timeValue === 'o') {
        return {
            isFullDay: true,
            startTime: defaultStartTime,
            endTime: defaultEndTime
        };
    }

    // Normalize the time value
    const normalizedValue = normalizeArabicNumerals(timeValue);
    
    // Try different parsing strategies
    const parseStrategies = [
        // Direct time range (8:30 - 14:00)
        () => {
            const timeParts = normalizedValue.split('-').map(t => t.trim());
            if (timeParts.length === 2) {
                return {
                    isFullDay: false,
                    startTime: timeParts[0],
                    endTime: timeParts[1]
                };
            }
            return null;
        },
        // Arabic time phrase parsing
        () => {
            const arabicParsed = parseArabicTimePhrase(timeValue);
            const timeParts = arabicParsed.split('-').map(t => t.trim());
            if (timeParts.length === 2) {
                return {
                    isFullDay: false,
                    startTime: timeParts[0],
                    endTime: timeParts[1]
                };
            }
            return null;
        }
    ];

    // Try each parsing strategy
    for (const strategy of parseStrategies) {
        const result = strategy();
        if (result) return result;
    }

    // If no parsing strategy works, throw an error
    throw new Error(`Unable to parse time slot: ${timeValue}`);
};

// Validate and format time
const validateAndFormatTime = (time) => {
    // Ensure time is in HH:MM format
    const formattedTime = moment(time, ['HH:mm', 'H:mm', 'HH:m', 'H:m']).format('HH:mm');
    
    if (formattedTime === 'Invalid date') {
        throw new Error(`Invalid time format: ${time}`);
    }
    
    return formattedTime;
};

module.exports = {
    parseTimeSlot,
    normalizeArabicNumerals,
    validateAndFormatTime
}; 