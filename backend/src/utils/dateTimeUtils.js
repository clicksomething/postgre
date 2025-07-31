/**
 * BULLETPROOF Date/Time Utilities
 * All date/time operations MUST go through these functions
 */

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Assert that a value is a valid Date object
 * @param {any} d - Value to validate
 * @param {string} context - Context for error message
 * @returns {Date} Valid Date object
 */
const assertValidDate = (d, context = 'Date validation') => {
  if (!(d instanceof Date)) {
    throw new Error(`${context}: ${d} is not a Date object`);
  }
  if (isNaN(d.getTime())) {
    throw new Error(`${context}: ${d} is an invalid Date`);
  }
  return d;
};

/**
 * Assert that a time string is valid
 * @param {string} timeStr - Time string to validate
 * @param {string} context - Context for error message
 * @returns {string} Validated time string
 */
const assertValidTimeString = (timeStr, context = 'Time validation') => {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`${context}: Time string is empty or invalid`);
  }
  
  // Accept HH:MM, HH:MM:SS, H:MM, H:MM:SS formats
  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const match = timeStr.match(timeRegex);
  
  if (!match) {
    throw new Error(`${context}: Invalid time format "${timeStr}". Expected HH:MM or HH:MM:SS`);
  }
  
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new Error(`${context}: Invalid time values in "${timeStr}"`);
  }
  
  return timeStr;
};

// ============================================================================
// TIME PARSING & CONVERSION
// ============================================================================

/**
 * Parse time string to minutes since midnight (UTC)
 * BULLETPROOF: Handles all time formats, validates input, returns consistent results
 * @param {string} timeStr - Time string (HH:MM, HH:MM:SS, H:MM, H:MM:SS)
 * @returns {number} Minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  const validTimeStr = assertValidTimeString(timeStr, 'parseTimeToMinutes');
  
  // Normalize to HH:MM:SS format
  const parts = validTimeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parts[2] ? parseInt(parts[2]) : 0;
  
  return hours * 60 + minutes + Math.round(seconds / 60);
};

/**
 * Format minutes to HH:MM string
 * @param {number} minutes - Minutes since midnight
 * @returns {string} HH:MM formatted time
 */
const formatMinutesToTime = (minutes) => {
  if (typeof minutes !== 'number' || minutes < 0 || minutes > 1440) {
    throw new Error(`Invalid minutes value: ${minutes}`);
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Check if two time ranges overlap
 * @param {number} start1 - Start time in minutes
 * @param {number} end1 - End time in minutes
 * @param {number} start2 - Start time in minutes
 * @param {number} end2 - End time in minutes
 * @returns {boolean} True if ranges overlap
 */
const timeRangesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// ============================================================================
// DATE HANDLING (UTC ONLY)
// ============================================================================

/**
 * Convert any date input to UTC Date object
 * BULLETPROOF: Handles strings, Date objects, timestamps
 * @param {any} dateInput - Date string, Date object, or timestamp
 * @returns {Date} UTC Date object
 */
const toUTCDate = (dateInput) => {
  if (!dateInput) {
    throw new Error('Date input is required');
  }
  
  let date;
  
  if (dateInput instanceof Date) {
    date = new Date(dateInput.getTime());
  } else if (typeof dateInput === 'string') {
    // Handle ISO strings, date strings, etc.
    date = new Date(dateInput);
  } else if (typeof dateInput === 'number') {
    // Handle timestamps
    date = new Date(dateInput);
  } else {
    throw new Error(`Invalid date input type: ${typeof dateInput}`);
  }
  
  return assertValidDate(date, 'toUTCDate');
};

/**
 * Get day name from UTC date (for comparison with timeslot days)
 * @param {Date|string} dateInput - Date to get day for
 * @param {string} timezone - Timezone for day calculation (default: Asia/Damascus)
 * @returns {string} Lowercase day name
 */
const getDayName = (dateInput, timezone = 'Asia/Damascus') => {
  const date = toUTCDate(dateInput);
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: timezone
  }).toLowerCase();
};

/**
 * Check if two dates are the same day (in specified timezone)
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @param {string} timezone - Timezone for comparison
 * @returns {boolean} True if same day
 */
const isSameDay = (date1, date2, timezone = 'Asia/Damascus') => {
  const day1 = getDayName(date1, timezone);
  const day2 = getDayName(date2, timezone);
  return day1 === day2;
};

// ============================================================================
// EXAM/TIMESLOT COMPARISON
// ============================================================================

/**
 * Check if an exam fits within a timeslot
 * BULLETPROOF: All date/time handling goes through validated functions
 * @param {Object} exam - Exam object with date, startTime, endTime
 * @param {Object} timeslot - Timeslot object with day, startTime, endTime
 * @param {string} timezone - Timezone for day comparison
 * @returns {boolean} True if exam fits in timeslot
 */
const examFitsInTimeslot = (exam, timeslot, timezone = 'Asia/Damascus') => {
  // Validate inputs
  if (!exam || !timeslot) {
    throw new Error('Exam and timeslot objects are required');
  }
  
  if (!timeslot.day) {
    throw new Error('Timeslot must have a day property');
  }
  
  // Get exam day name
  const examDay = getDayName(exam.date || exam.examdate, timezone);
  const slotDay = timeslot.day.toLowerCase();
  
  // Check day match
  if (examDay !== slotDay) {
    return false;
  }
  
  // Parse times to minutes
  const examStartMinutes = parseTimeToMinutes(exam.startTime || exam.starttime);
  const examEndMinutes = parseTimeToMinutes(exam.endTime || exam.endtime);
  const slotStartMinutes = parseTimeToMinutes(timeslot.startTime);
  const slotEndMinutes = parseTimeToMinutes(timeslot.endTime);
  
  // Check if exam fits within timeslot
  return slotStartMinutes <= examStartMinutes && slotEndMinutes >= examEndMinutes;
};

/**
 * Check if two exams overlap in time
 * @param {Object} exam1 - First exam
 * @param {Object} exam2 - Second exam
 * @param {string} timezone - Timezone for day comparison
 * @returns {boolean} True if exams overlap
 */
const examsOverlap = (exam1, exam2, timezone = 'Asia/Damascus') => {
  // Check if same day
  if (!isSameDay(exam1.date || exam1.examdate, exam2.date || exam2.examdate, timezone)) {
    return false;
  }
  
  // Parse times
  const start1 = parseTimeToMinutes(exam1.startTime || exam1.starttime);
  const end1 = parseTimeToMinutes(exam1.endTime || exam1.endtime);
  const start2 = parseTimeToMinutes(exam2.startTime || exam2.starttime);
  const end2 = parseTimeToMinutes(exam2.endTime || exam2.endtime);
  
  return timeRangesOverlap(start1, end1, start2, end2);
};

// ============================================================================
// FORMATTING FOR DISPLAY
// ============================================================================

/**
 * Format date for display (localized)
 * @param {Date|string} dateInput - Date to format
 * @param {string} locale - Locale for formatting
 * @param {string} timezone - Timezone for display
 * @returns {string} Formatted date string
 */
const formatDateForDisplay = (dateInput, locale = 'en-US', timezone = 'Asia/Damascus') => {
  const date = toUTCDate(dateInput);
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone
  });
};

/**
 * Format time for display
 * @param {string} timeStr - Time string to format
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} Formatted time string
 */
const formatTimeForDisplay = (timeStr, includeSeconds = false) => {
  const validTimeStr = assertValidTimeString(timeStr, 'formatTimeForDisplay');
  
  if (!includeSeconds) {
    // Return HH:MM format
    return validTimeStr.split(':').slice(0, 2).join(':');
  }
  
  return validTimeStr;
};

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy timeToMinutes function (for backward compatibility)
 * @deprecated Use parseTimeToMinutes instead
 */
const timeToMinutes = parseTimeToMinutes;

module.exports = {
  // Validation
  assertValidDate,
  assertValidTimeString,
  
  // Time parsing
  parseTimeToMinutes,
  formatMinutesToTime,
  timeRangesOverlap,
  
  // Date handling
  toUTCDate,
  getDayName,
  isSameDay,
  
  // Exam/timeslot comparison
  examFitsInTimeslot,
  examsOverlap,
  
  // Display formatting
  formatDateForDisplay,
  formatTimeForDisplay,
  
  // Legacy compatibility
  timeToMinutes
}; 