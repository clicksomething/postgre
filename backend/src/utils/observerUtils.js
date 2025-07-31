const { 
  parseTimeToMinutes, 
  getDayName 
} = require('./dateTimeUtils');

/**
 * Utility functions for observer-related operations
 * Shared across different assignment services
 */
class ObserverUtils {
  /**
   * Determine if an observer is a Doctor based on their title
   * @param {Object} observer - Observer object with title and scientificRank
   * @returns {boolean} - True if observer is a Doctor
   */
  static isDoctor(observer) {
    if (!observer) return false;
    
    const title = (observer.title || '').trim();
    const scientificRank = (observer.scientificRank || '').trim();
    
    // Check for exact "Dr." or "Dr" titles (case-insensitive)
    const isDrTitle = /^dr\.?$/i.test(title);
    const isDrRank = /^dr\.?$/i.test(scientificRank);
    
    return isDrTitle || isDrRank;
  }

  /**
   * Check if observer can take a specific exam based on their time slots
   * @param {Object} observer - Observer object with timeSlots
   * @param {Object} exam - Exam object with date, startMin, endMin
   * @returns {boolean} - True if observer can take the exam
   */
  static canObserverTakeExam(observer, exam) {
    // Check if observer has time slots that match this exam
    if (!observer.timeSlots || observer.timeSlots.length === 0) {
      // Full-time observer - can take any exam
      return true;
    }
    
    // Use bulletproof date/time utilities
    const examDay = getDayName(exam.date);
    
    // Check if observer has any time slot that could accommodate this exam
    const canTake = observer.timeSlots.some(slot => {
      if (!slot.day) return false;
      
      // Normalize day name for comparison
      const slotDay = slot.day.toLowerCase().trim();
      const normalizedSlotDay = this.normalizeDayName(slotDay);
      const slotStart = parseTimeToMinutes(slot.startTime);
      const slotEnd = parseTimeToMinutes(slot.endTime);
      
      const dayMatch = normalizedSlotDay === examDay;
      const timeFit = slotStart <= exam.startMin && slotEnd >= exam.endMin;
      
      // Strict matching - exam must fit completely within time slot
      return dayMatch && timeFit;
    });
    
    return canTake;
  }

  /**
   * Normalize day names for consistent comparison
   * @param {string} dayName - Day name to normalize
   * @returns {string} - Normalized day name
   */
  static normalizeDayName(dayName) {
    const day = dayName.toLowerCase().trim();
    
    switch (day) {
      case 'monday':
      case 'mon':
        return 'monday';
      case 'tuesday':
      case 'tue':
        return 'tuesday';
      case 'wednesday':
      case 'wed':
        return 'wednesday';
      case 'thursday':
      case 'thu':
        return 'thursday';
      case 'friday':
      case 'fri':
        return 'friday';
      case 'saturday':
      case 'sat':
        return 'saturday';
      case 'sunday':
      case 'sun':
        return 'sunday';
      default:
        return day;
    }
  }

  /**
   * Get observers filtered by role (doctor or secretary)
   * @param {Array} observers - Array of observer objects
   * @param {boolean} isDoctorRole - True for doctors, false for secretaries
   * @returns {Array} - Filtered observers
   */
  static getObserversByRole(observers, isDoctorRole) {
    return observers.filter(observer => 
      this.isDoctor(observer) === isDoctorRole
    );
  }

  /**
   * Get available observers for a specific exam
   * @param {Array} observers - Array of observer objects
   * @param {Object} exam - Exam object
   * @param {boolean} isDoctorRole - True for doctors, false for secretaries
   * @returns {Array} - Available observers for the exam
   */
  static getAvailableObserversForExam(observers, exam, isDoctorRole = null) {
    let filteredObservers = observers;
    
    // Filter by role if specified
    if (isDoctorRole !== null) {
      filteredObservers = this.getObserversByRole(observers, isDoctorRole);
    }
    
    // Filter by availability for this exam
    return filteredObservers.filter(observer => 
      this.canObserverTakeExam(observer, exam)
    );
  }

  /**
   * Calculate observer workload distribution
   * @param {Array} assignments - Array of assignment objects
   * @param {Array} observers - Array of observer objects
   * @returns {Object} - Workload statistics
   */
  static calculateWorkloadDistribution(assignments, observers) {
    const workload = new Map();
    
    // Initialize workload tracking
    observers.forEach(observer => {
      workload.set(observer.id, {
        observerId: observer.id,
        observerName: observer.name,
        isDoctor: this.isDoctor(observer),
        headAssignments: 0,
        secretaryAssignments: 0,
        totalAssignments: 0
      });
    });
    
    // Count assignments
    assignments.forEach(assignment => {
      if (assignment.headId && workload.has(assignment.headId)) {
        const stats = workload.get(assignment.headId);
        stats.headAssignments++;
        stats.totalAssignments++;
      }
      
      if (assignment.secretaryId && workload.has(assignment.secretaryId)) {
        const stats = workload.get(assignment.secretaryId);
        stats.secretaryAssignments++;
        stats.totalAssignments++;
      }
    });
    
    const workloadArray = Array.from(workload.values());
    const totalAssignments = workloadArray.reduce((sum, w) => sum + w.totalAssignments, 0);
    const avgWorkload = totalAssignments > 0 ? totalAssignments / workloadArray.length : 0;
    
    // Calculate distribution metrics
    const variance = workloadArray.reduce((sum, w) => 
      sum + Math.pow(w.totalAssignments - avgWorkload, 2), 0
    ) / workloadArray.length;
    
    const standardDeviation = Math.sqrt(variance);
    const fairnessScore = avgWorkload > 0 ? Math.max(0, 1 - (standardDeviation / avgWorkload)) : 1;
    
    return {
      workloadByObserver: workloadArray,
      averageWorkload: avgWorkload,
      standardDeviation,
      fairnessScore,
      totalAssignments
    };
  }
}

module.exports = ObserverUtils;