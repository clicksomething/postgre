const { 
  parseTimeToMinutes, 
  getDayName, 
  examsOverlap, 
  timeRangesOverlap,
  assertValidDate 
} = require('../utils/dateTimeUtils');
const ObserverUtils = require('../utils/observerUtils');

// Constants for validation
const VALIDATION_CONSTANTS = {
  TIMEOUT_MS: 5000, // 5 second timeout
  BATCH_SIZE: 1000, // Check timeout every N assignments
  OVERLAP_TOLERANCE_PERCENT: 0.05
};

class AssignmentValidationService {
  constructor() {
    this.logMessages = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logMessages.push(logEntry);
    
    if (data) {
      console.log(logEntry, data);
    } else {
      console.log(logEntry);
    }
  }

  /**
   * Optimized validation algorithm with O(n log n) complexity instead of O(n²)
   * Uses efficient data structures to prevent timeouts
   */
  async validateAssignments(assignments, data) {
    const validationStartTime = Date.now();
    
    // Early return for empty assignments
    if (!assignments || assignments.length === 0) {
      return { overlaps: [], roleViolations: [], timeslotViolations: [] };
    }
    
    const overlaps = [];
    const roleViolations = [];
    const timeslotViolations = [];
    
    // Create lookup maps for efficiency - O(n) instead of repeated O(n) lookups
    const examMap = new Map(data.exams.map(exam => [exam.id, exam]));
    const observerMap = new Map(data.observers.map(obs => [obs.id, obs]));
    
    // Group assignments by observer efficiently
    const observerSchedules = new Map();
    
    // Process all assignments in one pass - O(n)
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      const exam = examMap.get(assignment.examId);
      
      if (!exam) {
        this.log(`[VALIDATION] Warning: Exam ${assignment.examId} not found`);
        continue;
      }
      
      // Process head assignment
      if (assignment.headId) {
        const observer = observerMap.get(assignment.headId);
        
        // Role validation
        if (observer && !ObserverUtils.isDoctor(observer)) {
          roleViolations.push({
            examId: assignment.examId,
            observerId: assignment.headId,
            observerName: observer.name,
            role: 'head',
            issue: 'Non-doctor assigned as head'
          });
        }
        
        // Timeslot validation
        if (observer && !ObserverUtils.canObserverTakeExam(observer, exam)) {
          timeslotViolations.push({
            examId: assignment.examId,
            observerId: assignment.headId,
            observerName: observer.name,
            role: 'head',
            issue: 'Observer not available for exam timeslot'
          });
        }
        
        // Add to schedule for overlap checking
        this.addToObserverSchedule(observerSchedules, assignment.headId, {
          examId: assignment.examId,
          role: 'head',
          date: exam.date,
          startMin: exam.startMin,
          endMin: exam.endMin
        });
      }
      
      // Process secretary assignment
      if (assignment.secretaryId) {
        const observer = observerMap.get(assignment.secretaryId);
        
        // Timeslot validation for secretary
        if (observer && !ObserverUtils.canObserverTakeExam(observer, exam)) {
          timeslotViolations.push({
            examId: assignment.examId,
            observerId: assignment.secretaryId,
            observerName: observer.name,
            role: 'secretary',
            issue: 'Observer not available for exam timeslot'
          });
        }
        
        // Add to schedule for overlap checking
        this.addToObserverSchedule(observerSchedules, assignment.secretaryId, {
          examId: assignment.examId,
          role: 'secretary',
          date: exam.date,
          startMin: exam.startMin,
          endMin: exam.endMin
        });
      }
      
      // Timeout check every batch to avoid blocking
      if (i % VALIDATION_CONSTANTS.BATCH_SIZE === 0) {
        if (Date.now() - validationStartTime > VALIDATION_CONSTANTS.TIMEOUT_MS) {
          this.log(`[VALIDATION] ⏰ TIMEOUT after ${VALIDATION_CONSTANTS.TIMEOUT_MS}ms - stopping validation early`);
          break;
        }
      }
    }
    
    // Check for time overlaps using efficient sweep line algorithm - O(n log n)
    this.findTimeOverlaps(observerSchedules, overlaps, validationStartTime, VALIDATION_CONSTANTS.TIMEOUT_MS);
    
    // Log summary
    const totalViolations = overlaps.length + roleViolations.length + timeslotViolations.length;
    if (totalViolations > 0) {
      this.log(`[VALIDATION] Found ${totalViolations} violations: ${overlaps.length} overlaps, ${roleViolations.length} role, ${timeslotViolations.length} timeslot`);
    } else {
      this.log(`[VALIDATION] Validation passed: no violations found`);
    }
    
    const validationTime = Date.now() - validationStartTime;
    this.log(`[VALIDATION] Completed in ${validationTime}ms`);
    
    return { overlaps, roleViolations, timeslotViolations };
  }
  
  /**
   * Helper method to add assignment to observer schedule
   */
  addToObserverSchedule(observerSchedules, observerId, assignment) {
    if (!observerSchedules.has(observerId)) {
      observerSchedules.set(observerId, new Map()); // Group by date
    }
    
    const schedule = observerSchedules.get(observerId);
    const dateKey = assignment.date.getTime();
    
    if (!schedule.has(dateKey)) {
      schedule.set(dateKey, []);
    }
    
    schedule.get(dateKey).push(assignment);
  }
  
  /**
   * Efficient overlap detection using sweep line algorithm - O(n log n)
   */
  findTimeOverlaps(observerSchedules, overlaps, validationStartTime, timeoutMs) {
    observerSchedules.forEach((dateSchedules, observerId) => {
      // Timeout check
      if (Date.now() - validationStartTime > timeoutMs) {
        this.log(`[VALIDATION] ⏰ TIMEOUT during overlap detection`);
        return;
      }
      
      // Check overlaps within each date for this observer
      dateSchedules.forEach((assignments, dateKey) => {
        if (assignments.length <= 1) return;
        
        // Sort by start time - O(n log n)
        assignments.sort((a, b) => a.startMin - b.startMin);
        
        // Sweep line algorithm - O(n)
        for (let i = 0; i < assignments.length - 1; i++) {
          const current = assignments[i];
          const next = assignments[i + 1];
          
          // Check if current assignment overlaps with next
          if (current.endMin > next.startMin) {
            overlaps.push({
              observerId,
              exam1: {
                id: current.examId,
                role: current.role,
                date: current.date,
                time: `${current.startMin}-${current.endMin}`
              },
              exam2: {
                id: next.examId,
                role: next.role,
                date: next.date,
                time: `${next.startMin}-${next.endMin}`
              }
            });
          }
        }
      });
    });
  }

  // Observer utility methods moved to ObserverUtils

  /**
   * Get validation report summary
   */
  getValidationSummary(validationResult, totalExams) {
    const { overlaps, roleViolations, timeslotViolations } = validationResult;
    const totalViolations = overlaps.length + roleViolations.length + timeslotViolations.length;
    
    const criticalViolations = roleViolations.length + 
      (overlaps.length > totalExams * VALIDATION_CONSTANTS.OVERLAP_TOLERANCE_PERCENT ? overlaps.length : 0);
    
    return {
      totalViolations,
      criticalViolations,
      breakdown: {
        overlaps: overlaps.length,
        roleViolations: roleViolations.length,
        timeslotViolations: timeslotViolations.length
      },
      overlapThreshold: Math.ceil(totalExams * VALIDATION_CONSTANTS.OVERLAP_TOLERANCE_PERCENT),
      isValid: criticalViolations === 0
    };
  }
}

module.exports = AssignmentValidationService;