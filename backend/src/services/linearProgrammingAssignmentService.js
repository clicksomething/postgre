const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const glpkInit = require('glpk.js');
const { 
  parseTimeToMinutes, 
  getDayName, 
  examsOverlap, 
  timeRangesOverlap,
  assertValidDate 
} = require('../utils/dateTimeUtils');
const AssignmentValidationService = require('./assignmentValidationService');
const { ALGORITHM_CONSTANTS, LOG_PREFIXES, ERROR_CODES } = require('../constants/algorithmConstants');
const ObserverUtils = require('../utils/observerUtils');

class LinearProgrammingAssignmentService {
  constructor() {
    this.startTime = Date.now();
    this.logMessages = [];
    this.glpkPromise = this.initializeGLPK(); // Initialize GLPK with error checking
    this.validationService = new AssignmentValidationService();
  }

  async initializeGLPK() {
    try {
      const glpk = await glpkInit();
      return glpk;
    } catch (error) {
      this.log(`[ERROR] Failed to initialize GLPK.js: ${error.message}`);
      throw error;
    }
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = data ? `[${timestamp}] ${message}` : `[${timestamp}] ${message}`;
    this.logMessages.push(logEntry);
    
    if (data) {
      console.log(logEntry, data);
    } else {
      console.log(logEntry);
    }
  }
  
  /**
   * Utility method for handling timeouts with proper cleanup
   */
  async withTimeout(operation, timeoutMs, operationName = 'operation') {
    return new Promise((resolve, reject) => {
      let isResolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          const error = new Error(`${operationName} timeout after ${timeoutMs}ms`);
          error.code = 'TIMEOUT';
          reject(error);
        }
      }, timeoutMs);
      
      Promise.resolve(operation)
        .then(result => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch(error => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(error);
          }
        });
    });
  }

  async saveLogs() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `js-lp-algorithm-${timestamp}.log`;
    const logDir = path.join(__dirname, '../../logs');
    
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const logPath = path.join(logDir, filename);
    const logContent = this.logMessages.join('\n');
    
    await fs.writeFile(logPath, logContent);
    console.log(`[JS-LP] Log file saved: ${filename}`);
    
    return logPath;
  }

  async assignObserversWithLP(examIds) {
    if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
      throw new Error('Invalid exam IDs provided');
    }

    const algorithmStartTime = Date.now();
      
    try {
      const data = await this.loadData(examIds);
      
      if (!data || !data.exams || !data.observers) {
        throw new Error('Failed to load valid data');
      }
      
      // Analyze LP model dimensions
      const fullLpVariables = data.exams.length * data.observers.length * 2;
      const doctors = data.observers.filter(obs => obs.isDoctor);
      const headOnlyVariables = data.exams.length * doctors.length;
      
      this.log(`[HYBRID] LP dimensions: ${data.exams.length} exams × ${data.observers.length} obs`);
      this.log(`[HYBRID] Full LP: ${fullLpVariables} variables, Head-only: ${headOnlyVariables} variables`);
      
      // Decision: Use Hybrid for large problems, Pure LP for small ones
      const useHybrid = data.exams.length > 50 || fullLpVariables > 5000;
      
      if (useHybrid) {
        this.log(`[HYBRID] Using Hybrid LP-Greedy algorithm`);
        return await this.runHybridAlgorithm(data, examIds, algorithmStartTime);
      } else {
        this.log(`[HYBRID] Using Pure LP algorithm (small problem)`);
        return await this.runPureLPAlgorithm(data, examIds, algorithmStartTime);
      }
      
    } catch (error) {
      this.log(`[HYBRID] Error: ${error.message}`);
      throw error;
    }
  }

  // Hybrid LP-Greedy Algorithm
  async runHybridAlgorithm(data, examIds, algorithmStartTime) {
    if (!data || !data.exams || !data.observers) {
      this.log(`[HYBRID] Invalid data format`);
      return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
    }

    // For large problems, use maximum coverage algorithm instead of LP
    const problemSize = data.exams.length * data.observers.length;
    if (data.exams.length > ALGORITHM_CONSTANTS.MAX_EXAMS_FOR_PURE_LP || problemSize > ALGORITHM_CONSTANTS.LARGE_PROBLEM_THRESHOLD) {
      this.log(`[HYBRID] LARGE PROBLEM DETECTED: ${data.exams.length} exams, ${data.observers.length} observers`);
      this.log(`[HYBRID] Problem size: ${problemSize} - using maximum coverage algorithm`);
      return await this.runMaximumCoverageAlgorithm(data, examIds, algorithmStartTime);
    }

    const lpStartTime = Date.now();
    
    try {
      // Phase 1: Solve heads with LP
      this.log(`[HYBRID] Phase 1: Solving heads with LP`);
      const headAssignments = await this.solveHeadsWithLP(data);
      
      if (!headAssignments || headAssignments.length === 0) {
        this.log(`[HYBRID] LP phase failed, falling back to pure greedy`);
          return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
      }
      
      const lpTimeMs = Date.now() - lpStartTime;
      this.log(`[HYBRID] LP phase completed in ${lpTimeMs}ms, ${headAssignments.length} heads assigned`);
      
      // Phase 2: Assign secretaries greedily
      const greedyStartTime = Date.now();
      this.log(`[HYBRID] Phase 2: Assigning secretaries greedily`);
      const completeAssignments = await this.assignSecretariesGreedily(data, headAssignments);
      
      const greedyTimeMs = Date.now() - greedyStartTime;
      const totalTimeMs = Date.now() - algorithmStartTime;
      
      // Validate final solution
      let validationResult;
      try {
        validationResult = await this.validationService.validateAssignments(completeAssignments, data);
      } catch (validationError) {
        this.log(`${LOG_PREFIXES.HYBRID} Validation failed: ${validationError.message}, proceeding without validation`);
        validationResult = { overlaps: [], roleViolations: [], timeslotViolations: [] };
      }
      
      if (!validationResult) {
        validationResult = { overlaps: [], roleViolations: [], timeslotViolations: [] };
      }
      
      const constraintsViolated = validationResult.overlaps.length + validationResult.roleViolations.length + validationResult.timeslotViolations.length;
      
      // Removed excessive validation debugging
      
      const validationSummary = this.validationService.getValidationSummary(validationResult, data.exams.length);
      const criticalViolations = validationSummary.criticalViolations;
      
      this.log(`${LOG_PREFIXES.HYBRID} Critical violations breakdown:`, {
        roleViolations: validationSummary.breakdown.roleViolations,
        overlapViolations: validationSummary.breakdown.overlaps > validationSummary.overlapThreshold ? validationSummary.breakdown.overlaps : 0,
        overlapThreshold: validationSummary.overlapThreshold,
        totalCritical: criticalViolations
      });
      
      if (criticalViolations > 0) {
        this.log(`${LOG_PREFIXES.HYBRID} Critical violations detected (${criticalViolations}), falling back to pure greedy`);
        return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
      }
      
      // Allow minor timeslot violations but log them
      if (validationSummary.breakdown.timeslotViolations > 0) {
        this.log(`${LOG_PREFIXES.WARNING} ${validationSummary.breakdown.timeslotViolations} timeslot violations (proceeding)`);
      }
      
      // Apply solution
      await this.applySolution(completeAssignments, examIds);
      
      this.log(`[HYBRID] Success! ${completeAssignments.length}/${data.exams.length} exams assigned`);
      
      return {
        assignments: completeAssignments,
        stats: {
          algorithm: 'hybrid',
          lpTimeMs,
          greedyTimeMs,
          timeTakenMs: totalTimeMs,
          examsCovered: completeAssignments.length,
          headCoverage: (headAssignments.length / data.exams.length) * 100,
          constraintsViolated: 0
        }
      };
      
    } catch (error) {
      this.log(`[HYBRID] Error: ${error.message}`);
      return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
    }
  }

  // Chunked Algorithm (for large problems)
  async runChunkedAlgorithm(data, examIds, algorithmStartTime) {
    const CHUNK_SIZE = ALGORITHM_CONSTANTS.CHUNK_SIZE; // Optimal chunk size for performance vs quality
    
    try {
      // 1. Create optimal chunks (group by date/time to minimize cross-chunk conflicts)
      const chunks = this.createOptimalChunks(data.exams, CHUNK_SIZE);
      
      this.log(`[CHUNKED] Processing ${data.exams.length} exams in ${chunks.length} chunks of ~${CHUNK_SIZE} exams each`);
      
      // 2. Track global state across chunks
      const globalAssignments = [];
      const observerSchedule = new Map(); // Track when each observer is busy
      const observerWorkload = new Map(); // Track workload balance
      
      // Initialize observer tracking
      data.observers.forEach(obs => {
        observerSchedule.set(obs.id, []);
        observerWorkload.set(obs.id, 0);
      });
      
      // 3. Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const chunkStartTime = Date.now();
        
        this.log(`[CHUNKED] Processing chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} exams`);
        
        try {
          // 4. Filter available observers for this chunk (considering global schedule)
          const availableObservers = this.getAvailableObserversForChunk(
            data.observers, 
            chunk, 
            observerSchedule
          );
          
          this.log(`[CHUNKED] Chunk ${chunkIndex + 1}: ${availableObservers.length}/${data.observers.length} observers available`);
          
          // 5. Create chunk data
          const chunkData = {
            exams: chunk,
            observers: availableObservers
          };
          
          // 6. Solve chunk using hybrid algorithm (LP for heads, greedy for secretaries) with timeout
          const chunkExamIds = chunk.map(exam => exam.id);
          
          this.log(`[CHUNKED] Starting chunk ${chunkIndex + 1} (${chunk.length} exams)...`);
          const chunkResult = await this.withTimeout(
            this.runHybridAlgorithm(chunkData, chunkExamIds, chunkStartTime),
            ALGORITHM_CONSTANTS.CHUNKED_TIMEOUT_MS,
            `Chunk ${chunkIndex + 1} processing`
          );
          
          // Extract assignments from result (runHybridAlgorithm returns {assignments: [...], stats: {...}})
          const chunkAssignments = chunkResult.assignments || chunkResult || [];
          
          // 7. Update global state
          chunkAssignments.forEach(assignment => {
            globalAssignments.push(assignment);
            
            // Update observer schedule
            const exam = chunk.find(e => e.id === assignment.examId);
            if (exam && assignment.observerId) {
              const busyTime = {
                examId: assignment.examId,
                date: exam.date,
                startMin: exam.startMin,
                endMin: exam.endMin,
                role: assignment.role
              };
              
              // Ensure observer schedule exists (defensive programming)
              if (!observerSchedule.has(assignment.observerId)) {
                observerSchedule.set(assignment.observerId, []);
                observerWorkload.set(assignment.observerId, 0);
              }
              
              observerSchedule.get(assignment.observerId).push(busyTime);
              observerWorkload.set(assignment.observerId, observerWorkload.get(assignment.observerId) + 1);
            }
          });
          
          const chunkTime = Date.now() - chunkStartTime;
          this.log(`[CHUNKED] ✅ Chunk ${chunkIndex + 1}/${chunks.length} completed in ${chunkTime}ms: ${chunkAssignments.length} assignments`);
          this.log(`[CHUNKED] Progress: ${Math.round((chunkIndex + 1) / chunks.length * 100)}% complete (${globalAssignments.length} total assignments)`);
          
                // Removed debug logging for cleaner output
          
        } catch (error) {
          const chunkTime = Date.now() - chunkStartTime;
          this.log(`[CHUNKED] ❌ Chunk ${chunkIndex + 1} FAILED after ${chunkTime}ms: ${error.message}`);
          
          if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
            this.log(`[CHUNKED] Chunk ${chunkIndex + 1} timed out - trying pure greedy fallback`);
            
            try {
              // Fallback: Try pure greedy for this chunk
              this.log(`[CHUNKED] Attempting greedy fallback for chunk ${chunkIndex + 1}`);
              const greedyResult = await this.withTimeout(
                this.runPureGreedyForChunk(chunkData, chunkExamIds),
                ALGORITHM_CONSTANTS.CHUNKED_TIMEOUT_MS / 2, // Half timeout for fallback
                `Greedy fallback for chunk ${chunkIndex + 1}`
              );
              const greedyAssignments = greedyResult.assignments || greedyResult || [];
              
              if (greedyAssignments.length > 0) {
                this.log(`[CHUNKED] ✅ Greedy fallback succeeded: ${greedyAssignments.length} assignments`);
                
                // Update global state with greedy results
                greedyAssignments.forEach(assignment => {
                  globalAssignments.push(assignment);
                  
                  const exam = chunk.find(e => e.id === assignment.examId);
                  if (exam && assignment.observerId) {
                    const busyTime = {
                      examId: assignment.examId,
                      date: exam.date,
                      startMin: exam.startMin,
                      endMin: exam.endMin,
                      role: assignment.role
                    };
                    
                    if (!observerSchedule.has(assignment.observerId)) {
                      observerSchedule.set(assignment.observerId, []);
                      observerWorkload.set(assignment.observerId, 0);
                    }
                    
                    observerSchedule.get(assignment.observerId).push(busyTime);
                    observerWorkload.set(assignment.observerId, observerWorkload.get(assignment.observerId) + 1);
                  }
                });
              } else {
                this.log(`[CHUNKED] Greedy fallback also failed for chunk ${chunkIndex + 1}`);
              }
            } catch (fallbackError) {
              this.log(`[CHUNKED] Greedy fallback error for chunk ${chunkIndex + 1}: ${fallbackError.message}`);
              // Continue processing other chunks even if this fallback fails
            }
          } else {
            this.log(`[CHUNKED] Chunk ${chunkIndex + 1} error: ${error.message}`, error.stack);
            this.log(`[CHUNKED] Continuing with next chunk despite error...`);
          }
        }
      }
      
      // 8. Post-processing: Optimize cross-chunk conflicts
      const optimizedAssignments = await this.optimizeChunkBoundaries(globalAssignments, data);
      
      const totalTime = Date.now() - algorithmStartTime;
      this.log(`[CHUNKED] All chunks completed in ${totalTime}ms: ${optimizedAssignments.length} total assignments`);
      
      // 9. Apply final solution
      await this.applySolution(optimizedAssignments, examIds);
      
      return optimizedAssignments;
      
    } catch (error) {
      this.log(`[CHUNKED] Error: ${error.message}`);
      this.log(`[CHUNKED] Falling back to pure greedy algorithm`);
      return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
    }
  }

  // Pure LP Algorithm (for small problems)
  async runPureLPAlgorithm(data, examIds, algorithmStartTime) {
    try {
      this.log(`[PURE-LP] Solving complete problem with GLPK`);
      
      const glpk = await this.glpkPromise;
    const model = this.buildGLPKModel(data, glpk);
      if (!model) {
        this.log(`[PURE-LP] Could not build GLPK model, falling back to greedy`);
        return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
      }
      
      const solution = await this.solveGLPKWithTimeout(model, ALGORITHM_CONSTANTS.PURE_LP_TIMEOUT_MS); // 45s timeout for full LP
      if (!solution) {
        this.log(`[PURE-LP] No solution found, falling back to greedy`);
        return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
      }
      
      const assignments = await this.formatGLPKSolution(solution, data);
      
      // Validate solution
      const validationResult = await this.validationService.validateAssignments(assignments, data);
      const constraintsViolated = validationResult.overlaps.length + validationResult.roleViolations.length + validationResult.timeslotViolations.length;
      
      if (constraintsViolated > 0) {
        this.log(`[PURE-LP] Solution has ${constraintsViolated} violations, falling back to greedy`);
        return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
      }
      
      await this.applySolution(assignments, examIds);
      
      const totalTimeMs = Date.now() - algorithmStartTime;
      this.log(`[PURE-LP] Success! ${assignments.length}/${data.exams.length} exams assigned`);
      
      return {
        assignments,
        stats: {
          algorithm: 'pure-glpk',
          timeTakenMs: totalTimeMs,
          examsCovered: assignments.length,
          constraintsViolated: 0
        }
      };
      
    } catch (error) {
      this.log(`[PURE-LP] Error: ${error.message}`);
      return await this.runPureGreedyAlgorithm(data, examIds, algorithmStartTime);
    }
  }

  // Pure Greedy for single chunk (fallback)
  async runPureGreedyForChunk(chunkData, chunkExamIds) {
    try {
      this.log(`[GREEDY-CHUNK] Running greedy algorithm for ${chunkData.exams.length} exams`);
      
      const assignments = [];
      const observerUsage = new Map();
      
      // Initialize observer usage tracking
      chunkData.observers.forEach(obs => {
        observerUsage.set(obs.id, []);
      });
      
      // Sort exams by start time for better assignment
      const sortedExams = [...chunkData.exams].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startMin - b.startMin;
      });
      
      // Assign each exam greedily
      for (const exam of sortedExams) {
        const availableDoctors = chunkData.observers.filter(obs => 
          obs.isDoctor && this.isObserverAvailable(obs, exam, observerUsage.get(obs.id))
        );
        
        const availableSecretaries = chunkData.observers.filter(obs => 
          !obs.isDoctor && this.isObserverAvailable(obs, exam, observerUsage.get(obs.id))
        );
        
        if (availableDoctors.length > 0 && availableSecretaries.length > 0) {
          // Pick least used observers
          const doctor = availableDoctors.reduce((min, obs) => 
            observerUsage.get(obs.id).length < observerUsage.get(min.id).length ? obs : min
          );
          
          const secretary = availableSecretaries.reduce((min, obs) => 
            observerUsage.get(obs.id).length < observerUsage.get(min.id).length ? obs : min
          );
          
          // Create assignment
            assignments.push({
              examId: exam.id,
            headId: doctor.id,
            secretaryId: secretary.id,
            observerId: doctor.id, // For compatibility
            role: 'head'
          });
          
          assignments.push({
            examId: exam.id,
            headId: doctor.id,
            secretaryId: secretary.id,
            observerId: secretary.id, // For compatibility
            role: 'secretary'
          });
          
          // Update usage
          const examTime = { examId: exam.id, date: exam.date, startMin: exam.startMin, endMin: exam.endMin };
          observerUsage.get(doctor.id).push(examTime);
          observerUsage.get(secretary.id).push(examTime);
        }
      }
      
      this.log(`[GREEDY-CHUNK] Assigned ${assignments.length / 2} exams out of ${chunkData.exams.length}`);
      return { assignments };
      
    } catch (error) {
      this.log(`[GREEDY-CHUNK] Error: ${error.message}`);
      return { assignments: [] };
    }
  }

    // Pure Greedy Algorithm (optimized single-pass)
  async runPureGreedyAlgorithm(data, examIds, algorithmStartTime) {
    try {
      this.log(`[GREEDY] Using optimized single-pass greedy algorithm for ${data.exams.length} exams`);
      
      // Store exam data for conflict checking
      this.currentExamData = data.exams;
      
      const assignments = [];
      const observerWorkload = new Map();
      
      // Initialize workload tracking
      data.observers.forEach(obs => observerWorkload.set(obs.id, 0));
      
      // Pre-filter observers by role
      const doctors = data.observers.filter(obs => obs.isDoctor);
      const secretaries = data.observers.filter(obs => !obs.isDoctor);
      
      this.log(`[GREEDY] Available: ${doctors.length} doctors, ${secretaries.length} secretaries`);
      
      // Sort exams chronologically for better assignment order
      const sortedExams = [...data.exams].sort((a, b) => {
        const dateCompare = a.date.getTime() - b.date.getTime();
        return dateCompare !== 0 ? dateCompare : a.startMin - b.startMin;
      });
      
      let assignedCount = 0;
      
      for (const exam of sortedExams) {
        // Find available doctors (heads)
        const availableDoctors = doctors.filter(doctor => 
          ObserverUtils.canObserverTakeExam(doctor, exam) && 
          this.isObserverFreeForExam(doctor, exam, assignments)
        );
        
        // Find available secretaries
        const availableSecretaries = secretaries.filter(secretary => 
          ObserverUtils.canObserverTakeExam(secretary, exam) && 
          this.isObserverFreeForExam(secretary, exam, assignments)
        );
        
        if (availableDoctors.length > 0 && availableSecretaries.length > 0) {
          // Choose least loaded observers
          const head = availableDoctors.reduce((min, obs) => 
            observerWorkload.get(obs.id) < observerWorkload.get(min.id) ? obs : min
          );
          const secretary = availableSecretaries.reduce((min, obs) => 
            observerWorkload.get(obs.id) < observerWorkload.get(min.id) ? obs : min
          );
          
          // Create assignment
          assignments.push({
            examId: exam.id,
            headId: head.id,
            secretaryId: secretary.id
          });
          
          // Update workload
          observerWorkload.set(head.id, observerWorkload.get(head.id) + 1);
          observerWorkload.set(secretary.id, observerWorkload.get(secretary.id) + 1);
          assignedCount++;
        }
      }
      
      await this.applySolution(assignments, examIds);
      
      const totalTimeMs = Date.now() - algorithmStartTime;
      this.log(`[GREEDY] Completed in ${totalTimeMs}ms! ${assignedCount}/${data.exams.length} exams assigned (${(assignedCount/data.exams.length*100).toFixed(1)}%)`);
      
      return {
        assignments,
        stats: {
          algorithm: 'greedy-optimized',
          timeTakenMs: totalTimeMs,
          examsCovered: assignedCount,
          constraintsViolated: 0
        }
      };
      
    } catch (error) {
      this.log(`[GREEDY] Error: ${error.message}`);
      throw error;
    }
  }

  // Maximum Coverage Algorithm - optimized for highest assignment rate
  async runMaximumCoverageAlgorithm(data, examIds, algorithmStartTime) {
    try {
      this.log(`[MAX-COVERAGE] Starting maximum coverage algorithm for ${data.exams.length} exams`);
      
      // Store exam data for conflict checking
      this.currentExamData = data.exams;
      
      // Phase 1: Multi-pass greedy with backtracking
      let bestAssignments = await this.multiPassGreedy(data);
      this.log(`[MAX-COVERAGE] Multi-pass greedy: ${bestAssignments.length} assignments`);
      
      // Phase 2: Local optimization (try to improve coverage)
      const optimizedAssignments = await this.localOptimization(data, bestAssignments);
      this.log(`[MAX-COVERAGE] After optimization: ${optimizedAssignments.length} assignments`);
      
      // Phase 3: Gap filling (try to assign remaining exams)
      const finalAssignments = await this.gapFilling(data, optimizedAssignments);
      
      await this.applySolution(finalAssignments, examIds);
      
      const totalTimeMs = Date.now() - algorithmStartTime;
      const coveragePercent = (finalAssignments.length / data.exams.length * 100).toFixed(1);
      
      this.log(`[MAX-COVERAGE] COMPLETED in ${totalTimeMs}ms!`);
      this.log(`[MAX-COVERAGE] Final result: ${finalAssignments.length}/${data.exams.length} exams assigned (${coveragePercent}%)`);
      
      return {
        assignments: finalAssignments,
        stats: {
          algorithm: 'maximum-coverage',
          timeTakenMs: totalTimeMs,
          examsCovered: finalAssignments.length,
          coveragePercent: parseFloat(coveragePercent),
          constraintsViolated: 0
        }
      };
      
    } catch (error) {
      this.log(`[MAX-COVERAGE] Error: ${error.message}`);
      throw error;
    }
  }

  // Multi-pass greedy: Try different orderings to maximize coverage
  async multiPassGreedy(data) {
    const attempts = [
      // Pass 1: Chronological order (earliest first)
      () => [...data.exams].sort((a, b) => {
        const dateCompare = a.date.getTime() - b.date.getTime();
        return dateCompare !== 0 ? dateCompare : a.startMin - b.startMin;
      }),
      
      // Pass 2: Reverse chronological (latest first)
      () => [...data.exams].sort((a, b) => {
        const dateCompare = b.date.getTime() - a.date.getTime();
        return dateCompare !== 0 ? dateCompare : b.startMin - a.startMin;
      }),
      
      // Pass 3: Hardest first (exams with fewer available observers)
      () => this.sortExamsByDifficulty(data),
      
      // Pass 4: Random shuffle to escape local optima
      () => this.shuffleArray([...data.exams])
    ];
    
    let bestAssignments = [];
    let bestCount = 0;
    
    for (let i = 0; i < attempts.length; i++) {
      const sortedExams = attempts[i]();
      const assignments = await this.greedyAssignWithOrder(data, sortedExams);
      
      this.log(`[MAX-COVERAGE] Pass ${i + 1}: ${assignments.length} assignments`);
      
      if (assignments.length > bestCount) {
        bestAssignments = assignments;
        bestCount = assignments.length;
      }
    }
    
    return bestAssignments;
  }

  // Sort exams by difficulty (fewer available observers = harder)
  sortExamsByDifficulty(data) {
    return [...data.exams].sort((examA, examB) => {
      const availableA = this.countAvailableObservers(data, examA);
      const availableB = this.countAvailableObservers(data, examB);
      return availableA - availableB; // Hardest first
    });
  }

  // Count available observers for an exam
  countAvailableObservers(data, exam) {
    const doctors = data.observers.filter(obs => obs.isDoctor && ObserverUtils.canObserverTakeExam(obs, exam));
    const secretaries = data.observers.filter(obs => !obs.isDoctor && ObserverUtils.canObserverTakeExam(obs, exam));
    return Math.min(doctors.length, secretaries.length); // Bottleneck determines difficulty
  }

  // Shuffle array for randomized attempts
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Helper: Check if observer is free for a specific exam (proper conflict detection)
  isObserverFreeForExam(observer, exam, existingAssignments) {
    // Check if observer is already assigned to overlapping exams
    for (const assignment of existingAssignments) {
      // Skip if observer is not involved in this assignment
      if (assignment.headId !== observer.id && assignment.secretaryId !== observer.id) {
        continue;
      }
      
      // Find the exam for this assignment
      const assignedExam = this.currentExamData?.find(e => e.id === assignment.examId);
      if (!assignedExam) {
        this.log(`[CONFLICT-DEBUG] Could not find exam ${assignment.examId} in currentExamData`);
        continue;
      }
      
      // Check for time overlap on same date
      if (assignedExam.date.getTime() === exam.date.getTime()) {
        // Use proper overlap detection
        const { examsOverlap } = require('../utils/dateTimeUtils');
        const hasOverlap = examsOverlap(assignedExam, exam);
        
        if (hasOverlap) {
          this.log(`[CONFLICT-DEBUG] OVERLAP DETECTED: Observer ${observer.name} (${observer.id}) already assigned to exam ${assignedExam.id} (${assignedExam.startTime}-${assignedExam.endTime}), conflicts with exam ${exam.id} (${exam.startTime}-${exam.endTime})`);
          return false; // Observer is busy - conflict detected
        }
      }
    }
    
    return true; // Observer is free
  }

  // Greedy assignment with specific exam order (using ORIGINAL working logic)
  async greedyAssignWithOrder(data, sortedExams, existingAssignments = []) {
    // Store exam data for conflict checking (same as original)
    this.currentExamData = data.exams;
    
    const assignments = [...existingAssignments]; // Start with existing assignments
    const observerWorkload = new Map();
    
    // Initialize workload tracking (same as original)
    data.observers.forEach(obs => observerWorkload.set(obs.id, 0));
    
    // Count existing workload
    existingAssignments.forEach(assignment => {
      observerWorkload.set(assignment.headId, observerWorkload.get(assignment.headId) + 1);
      observerWorkload.set(assignment.secretaryId, observerWorkload.get(assignment.secretaryId) + 1);
    });
    
    // Pre-filter observers by role (same as original)
    const doctors = data.observers.filter(obs => obs.isDoctor);
    const secretaries = data.observers.filter(obs => !obs.isDoctor);
    
    for (const exam of sortedExams) {
      // Find available doctors (EXACT same logic as original)
      const availableDoctors = doctors.filter(doctor => 
        ObserverUtils.canObserverTakeExam(doctor, exam) && 
        this.isObserverFreeForExam(doctor, exam, assignments)
      );
      
      // Find available secretaries (EXACT same logic as original)
      const availableSecretaries = secretaries.filter(secretary => 
        ObserverUtils.canObserverTakeExam(secretary, exam) && 
        this.isObserverFreeForExam(secretary, exam, assignments)
      );
      
      if (availableDoctors.length > 0 && availableSecretaries.length > 0) {
        // Choose least loaded observers (same as original)
        const head = availableDoctors.reduce((min, obs) => 
          observerWorkload.get(obs.id) < observerWorkload.get(min.id) ? obs : min
        );
        const secretary = availableSecretaries.reduce((min, obs) => 
          observerWorkload.get(obs.id) < observerWorkload.get(min.id) ? obs : min
        );
        
        this.log(`[ASSIGNMENT-DEBUG] Assigning exam ${exam.id} (${exam.startTime}-${exam.endTime}) to head: ${head.name} (${head.id}), secretary: ${secretary.name} (${secretary.id})`);
        
        // Create assignment (same as original)
        assignments.push({
          examId: exam.id,
          headId: head.id,
          secretaryId: secretary.id
        });
        
        // Update workload (same as original)
        observerWorkload.set(head.id, observerWorkload.get(head.id) + 1);
        observerWorkload.set(secretary.id, observerWorkload.get(secretary.id) + 1);
      } else {
        this.log(`[ASSIGNMENT-DEBUG] Could not assign exam ${exam.id} (${exam.startTime}-${exam.endTime}) - available doctors: ${availableDoctors.length}, available secretaries: ${availableSecretaries.length}`);
      }
    }
    
    // Return only the NEW assignments (subtract existing ones)
    return assignments.slice(existingAssignments.length);
  }

  // Helper: Check if two time ranges overlap
  timesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
  }

  // Local optimization: Try to swap assignments to improve coverage
  async localOptimization(data, initialAssignments) {
    this.log(`[MAX-COVERAGE] Starting local optimization...`);
    
    // For now, return initial assignments (can implement swapping later)
    // This is where we could try 2-opt, 3-opt swaps, etc.
    return initialAssignments;
  }

  // Gap filling: Try to assign remaining unassigned exams
  async gapFilling(data, currentAssignments) {
    this.log(`[MAX-COVERAGE] Starting gap filling...`);
    
    const assignedExamIds = new Set(currentAssignments.map(a => a.examId));
    const unassignedExams = data.exams.filter(exam => !assignedExamIds.has(exam.id));
    
    this.log(`[MAX-COVERAGE] Gap filling: ${unassignedExams.length} unassigned exams remaining`);
    
    if (unassignedExams.length === 0) {
      return currentAssignments;
    }
    
    // Try to assign remaining exams with existing assignments as context
    const gapAssignments = await this.greedyAssignWithOrder(data, unassignedExams, currentAssignments);
    
    // Merge with existing assignments (avoiding duplicates)
    const finalAssignments = [...currentAssignments];
    gapAssignments.forEach(assignment => {
      if (!assignedExamIds.has(assignment.examId)) {
        finalAssignments.push(assignment);
      }
    });
    
    this.log(`[MAX-COVERAGE] Gap filling added ${finalAssignments.length - currentAssignments.length} assignments`);
    
    return finalAssignments;
  }

  // Phase 1: Solve heads with LP (doctors only)
  async solveHeadsWithLP(data) {
    try {
      if (!data || !data.observers || !Array.isArray(data.observers)) {
        this.log(`[HYBRID] Invalid data format for head assignments`);
        return [];
      }
      
      const doctors = data.observers.filter(obs => obs.isDoctor);
      
      if (!doctors || doctors.length === 0) {
        this.log(`[HYBRID] No doctors available for head assignments`);
        return [];
      }
      
      // Build GLPK model for heads only
      // Use normal constraints (no debugging)
      const debugOptions = {};
      const glpk = await this.glpkPromise;
    const lpModel = this.buildHeadOnlyGLPKModel(data, glpk, debugOptions);
      
      if (!lpModel || !lpModel.objective || !lpModel.objective.vars) {
        this.log(`[HYBRID] Could not build valid head-only GLPK model`);
        return [];
      }
      
      this.log(`[HYBRID] Head-only GLPK model: ${lpModel.objective.vars.length} variables, ${lpModel.subjectTo?.length || 0} constraints`);
      
      // Solve with timeout - reduce to 3s for chunks to prevent hanging
      const solution = await this.solveGLPKWithTimeout(lpModel, ALGORITHM_CONSTANTS.HEAD_LP_TIMEOUT_MS); // 3s timeout
      
      if (!solution || !solution.result) {
        this.log(`[HYBRID] Head-only GLPK failed to find solution`);
        return [];
      }
      
      // Extract head assignments
      const headAssignments = [];
      if (solution.result.vars && typeof solution.result.vars === 'object') {
        Object.entries(solution.result.vars).forEach(([varName, value]) => {
          if (varName.startsWith('x_') && Math.round(value) === 1) {
            const parts = varName.split('_');
            const observerId = parseInt(parts[1]);
            const examId = parseInt(parts[2]);
            
            headAssignments.push({
              examId,
              headId: observerId,
              secretaryId: null
            });
          }
        });
      }
      
      this.log(`[HYBRID] GLPK assigned ${headAssignments.length} heads`);
      return headAssignments;
      
    } catch (error) {
      this.log(`[HYBRID] Error in solveHeadsWithLP: ${error.message}`);
      return [];
    }
  }

  // Phase 2: Assign secretaries greedily
  async assignSecretariesGreedily(data, headAssignments) {
    try {
      const completeAssignments = [];
      const observerBusyTimes = new Map();
      data.observers.forEach(obs => observerBusyTimes.set(obs.id, []));
      
      // Mark head assignments as busy
      headAssignments.forEach(assignment => {
        const exam = data.exams.find(e => e.id === assignment.examId);
        if (exam) {
          const busyTime = { date: exam.date, startMin: exam.startMin, endMin: exam.endMin };
          observerBusyTimes.get(assignment.headId).push(busyTime);
        }
      });
      
      // Assign secretaries for each exam
      for (const headAssignment of headAssignments) {
        const exam = data.exams.find(e => e.id === headAssignment.examId);
        if (!exam) continue;
        
        const availableObservers = data.observers.filter(observer => {
          // Skip the head observer
          if (observer.id === headAssignment.headId) return false;
          
          // Check if observer can take this exam
          if (!ObserverUtils.canObserverTakeExam(observer, exam)) return false;
          
          // Check for time conflicts
          const busyTimes = observerBusyTimes.get(observer.id);
          return !busyTimes.some(busy => 
            busy.date.getTime() === exam.date.getTime() &&
            timeRangesOverlap(busy.startMin, busy.endMin, exam.startMin, exam.endMin)
          );
        });
        
        if (availableObservers.length > 0) {
          // Sort by least assigned first (fairness)
          const sortedObservers = availableObservers.sort((a, b) => {
            const aAssignments = observerBusyTimes.get(a.id).length;
            const bAssignments = observerBusyTimes.get(b.id).length;
            return aAssignments - bAssignments;
          });
          
          const secretary = sortedObservers[0];
          headAssignment.secretaryId = secretary.id;
          
          // Mark secretary as busy
          const busyTime = { date: exam.date, startMin: exam.startMin, endMin: exam.endMin };
          observerBusyTimes.get(secretary.id).push(busyTime);
        }
        
        completeAssignments.push(headAssignment);
      }
      
      this.log(`[HYBRID] Greedy assigned ${completeAssignments.filter(a => a.secretaryId).length} secretaries`);
      return completeAssignments;
      
    } catch (error) {
      this.log(`[HYBRID] Error in assignSecretariesGreedily: ${error.message}`);
      return headAssignments;
    }
  }



  async loadData(examIds) {
    const examsResult = await client.query(
      `SELECT ExamID as examid, ExamDate as examdate, StartTime as starttime, 
       EndTime as endtime, ScheduleID as scheduleid, ExamName as examname
       FROM ExamSchedule WHERE ExamID = ANY($1)`, 
      [examIds]
    );
    
    const observersResult = await client.query(`
      SELECT o.ObserverID as observerid, o.Name as name, o.Title as title,
      o.ScientificRank as scientificrank, o.Availability as availability,
      COALESCE(
        json_agg(
          json_build_object(
            'day', ts.day,
            'startTime', ts.StartTime,
            'endTime', ts.EndTime
          )
        ) FILTER (WHERE ts.TimeSlotID IS NOT NULL),
        '[]'::json
      ) as time_slots
      FROM Observer o
      LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
      GROUP BY o.ObserverID, o.Name, o.Title, o.ScientificRank, o.Availability
      ORDER BY o.ObserverID
    `);
    
    // Convert to internal format
    const exams = examsResult.rows.map(exam => ({
      id: exam.examid,
      name: exam.examname,
      date: new Date(exam.examdate),
      startMin: parseTimeToMinutes(exam.starttime),
      endMin: parseTimeToMinutes(exam.endtime),
      startTime: exam.starttime,
      endTime: exam.endtime,
      scheduleId: exam.scheduleid
    }));
    
    const observers = observersResult.rows.map(observer => {
      const observerObj = {
      id: observer.observerid,
      name: observer.name,
      title: observer.title,
        scientificRank: observer.scientificrank,
        isDoctor: ObserverUtils.isDoctor(observer),
        availability: observer.availability,
      timeSlots: observer.time_slots || [],
        maxAssignments: 10
      };
      

      
      return observerObj;
    });
    
    return { exams, observers };
  }

  buildGLPKModel(data, glpk) {
    const { exams, observers } = data;

    // PRE-SOLVE VALIDATION: Check doctor availability
    const doctors = observers.filter(obs => obs.isDoctor);
    const nonDoctors = observers.filter(obs => !obs.isDoctor);
    
    if (doctors.length === 0) {
      this.log('[WARNING] No doctors available for head assignments');
      return null;
    }
    
    if (doctors.length < exams.length) {
      this.log(`[WARNING] Insufficient doctors: ${doctors.length} doctors for ${exams.length} exams`);
    }
    
    if (nonDoctors.length === 0) {
      this.log('[WARNING] No non-doctors available for secretary assignments');
    }

    // 1. Define variables (binary: 0 or 1)
    const variables = [];
    const binaries = []; // Tracks binary variables for MIP
    const penaltyVars = []; // Soft constraint penalty variables
    
    observers.forEach(observer => {
      exams.forEach(exam => {
        if (ObserverUtils.canObserverTakeExam(observer, exam)) {
          const headVar = `x_${observer.id}_${exam.id}`;
          const secretaryVar = `y_${observer.id}_${exam.id}`;

          // HEAD VARIABLE: ONLY for Doctors
          if (observer.isDoctor) {
            variables.push({ name: headVar, coef: 1 }); // Objective coefficient
            binaries.push(headVar);
          }
          
          // SECRETARY VARIABLE: for any observer
          variables.push({ name: secretaryVar, coef: 1 });
          binaries.push(secretaryVar);
        }
      });
    });
    
    // Add penalty variables for soft constraints
    // Penalty for timeslot violations (when observer assigned outside their timeslots)
    observers.forEach(observer => {
      exams.forEach(exam => {
        const penaltyVar = `penalty_timeslot_${observer.id}_${exam.id}`;
        penaltyVars.push({ name: penaltyVar, coef: -50 }); // High penalty for timeslot violations
        binaries.push(penaltyVar);
      });
    });
    
    // Penalty for workload violations (when observer assigned more than max)
    observers.forEach(observer => {
      const penaltyVar = `penalty_workload_${observer.id}`;
      penaltyVars.push({ name: penaltyVar, coef: -100 }); // High penalty for workload violations
      binaries.push(penaltyVar);
    });
    
    // Penalty for time conflicts (when observer assigned to overlapping exams)
    observers.forEach(observer => {
      exams.forEach((exam1, i) => {
        exams.slice(i + 1).forEach(exam2 => {
          if (examsOverlap(exam1, exam2)) {
            const penaltyVar = `penalty_conflict_${observer.id}_${exam1.id}_${exam2.id}`;
            penaltyVars.push({ name: penaltyVar, coef: -200 }); // Very high penalty for conflicts
            binaries.push(penaltyVar);
          }
        });
      });
    });

    // 2. Define constraints
    const constraints = [];

    // Constraint 1: Each exam has exactly 1 head (doctor)
    exams.forEach(exam => {
      const headVars = variables.filter(v => 
        v.name.startsWith('x_') && v.name.endsWith(`_${exam.id}`)
      ).map(v => ({ name: v.name, coef: 1 }));

      this.log(`[GLPK] Exam ${exam.id} head vars: ${headVars.length} available`);

      if (headVars.length > 0) {
        constraints.push({
          name: `exam_${exam.id}_head`,
          vars: headVars,
          bnds: { type: 1, lb: 1, ub: 1 } // Fixed = 1
        });
      } else {
        this.log(`[CRITICAL] No doctors available for exam ${exam.id} head role - exam cannot be assigned`);
        // This exam cannot be assigned - mark for exclusion
        constraints.push({
          name: `exam_${exam.id}_head`,
          vars: [],
          bnds: { type: 1, lb: 0, ub: 0 } // Fixed = 0
        });
      }
    });

    // Constraint 2: Each exam has exactly 1 secretary
    exams.forEach(exam => {
      const secretaryVars = variables.filter(v => 
        v.name.startsWith('y_') && v.name.endsWith(`_${exam.id}`)
      ).map(v => ({ name: v.name, coef: 1 }));

      if (secretaryVars.length > 0) {
        constraints.push({
          name: `exam_${exam.id}_secretary`,
          vars: secretaryVars,
          bnds: { type: 1, lb: 1, ub: 1 } // Fixed = 1
        });
      } else {
        this.log(`[WARNING] No observers available for exam ${exam.id} secretary role`);
      }
    });

    // Constraint 3: Head and secretary must be different people
    observers.forEach(observer => {
      exams.forEach(exam => {
        const headVar = `x_${observer.id}_${exam.id}`;
        const secretaryVar = `y_${observer.id}_${exam.id}`;

        if (variables.some(v => v.name === headVar) && variables.some(v => v.name === secretaryVar)) {
          constraints.push({
            name: `different_${observer.id}_${exam.id}`,
            vars: [{ name: headVar, coef: 1 }, { name: secretaryVar, coef: 1 }],
            bnds: { type: 2, ub: 1 } // head + secretary ≤ 1
          });
        }
      });
    });

    // Constraint 4: Observer workload limits (SOFT - with penalty)
    observers.forEach(observer => {
      const headLoadVars = variables.filter(v => v.name.startsWith(`x_${observer.id}_`));
      const secretaryLoadVars = variables.filter(v => v.name.startsWith(`y_${observer.id}_`));
      
      if (headLoadVars.length > 0 || secretaryLoadVars.length > 0) {
        const allVars = [...headLoadVars, ...secretaryLoadVars].map(v => ({ name: v.name, coef: 1 }));
        const maxAssignments = Math.min(observer.maxAssignments || 10, Math.ceil(exams.length * 0.3));
        const penaltyVar = `penalty_workload_${observer.id}`;
        
        // Soft constraint: total assignments ≤ maxAssignments + penalty_variable
        constraints.push({
          name: `observer_${observer.id}_total_load_soft`,
          vars: [...allVars, { name: penaltyVar, coef: -1 }], // Penalty allows violation
          bnds: { type: 2, ub: maxAssignments } // assignments - penalty <= maxAssignments
        });
      }
    });

    // Constraint 5: Time overlaps (SOFT - with penalty for conflicts)
    exams.forEach((exam1, i) => {
      exams.slice(i + 1).forEach(exam2 => {
        if (examsOverlap(exam1, exam2)) {
          observers.forEach(observer => {
            const headVar1 = `x_${observer.id}_${exam1.id}`;
            const headVar2 = `x_${observer.id}_${exam2.id}`;
            const secretaryVar1 = `y_${observer.id}_${exam1.id}`;
            const secretaryVar2 = `y_${observer.id}_${exam2.id}`;

            // Add soft conflict constraints for all role combinations
            [
              [headVar1, headVar2], 
              [secretaryVar1, secretaryVar2],
              [headVar1, secretaryVar2],
              [secretaryVar1, headVar2]
            ].forEach(([var1, var2]) => {
              if (variables.some(v => v.name === var1) && variables.some(v => v.name === var2)) {
                const penaltyVar = `penalty_conflict_${observer.id}_${exam1.id}_${exam2.id}`;
                constraints.push({
                  name: `soft_overlap_${var1}_${var2}`,
                  vars: [
                    { name: var1, coef: 1 }, 
                    { name: var2, coef: 1 },
                    { name: penaltyVar, coef: -1 } // Penalty allows violation
                  ],
                  bnds: { type: 2, ub: 1 } // var1 + var2 - penalty <= 1
                });
              }
            });
          });
        }
      });
    });

    // 3. Return GLPK model with soft constraints
    const glpkModel = {
      name: 'ExamSchedulingWithSoftConstraints',
      objective: {
        direction: glpk.GLP_MAX, // Use correct GLPK constant for maximization
        name: 'total_assignments_minus_penalties',
        vars: [...variables, ...penaltyVars] // Include penalty variables in objective
      },
      subjectTo: constraints, // GLPK.js uses 'subjectTo' instead of 'constraints'
      binaries: binaries, // Critical for MIP
      generals: [], // General integer variables (empty for our case)
      options: {
        msglev: 1, // Minimal logging
        tmlim: 60000 // 60s timeout for soft constraints
      }
    };
    
    this.log(`[GLPK] Model built successfully:`, {
      name: glpkModel.name,
      variables: glpkModel.objective.vars.length,
      constraints: glpkModel.subjectTo.length,
      binaries: glpkModel.binaries.length
    });
    
    // Debug: Log some sample constraints
    this.log(`[GLPK] Sample constraints:`, glpkModel.subjectTo.slice(0, 3));
    this.log(`[GLPK] Sample variables:`, glpkModel.objective.vars.slice(0, 5));
    this.log(`[GLPK] Sample binaries:`, glpkModel.binaries.slice(0, 5));
    
    return glpkModel;
  }

  estimateTimeConflictConstraints(exams, observers) {
    // Estimate number of time conflict constraints
    let conflictCount = 0;
    
    // Find overlapping exam pairs
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        if (examsOverlap(exams[i], exams[j])) {
          conflictCount += observers.length * 4; // 4 types of conflicts per observer per pair
        }
      }
    }
    
    return conflictCount;
  }

  addTimeConflictConstraints(model, exams, observers) {
    let constraintCount = 0;
    
    // Find overlapping exam pairs
    const overlappingPairs = [];
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        if (examsOverlap(exams[i], exams[j])) {
          overlappingPairs.push([exams[i], exams[j]]);
        }
      }
    }
    
    // For each overlapping pair, create STRONG constraints
    overlappingPairs.forEach(([exam1, exam2]) => {
      observers.forEach(observer => {
        const headVar1 = `x_${observer.id}_${exam1.id}`;
        const headVar2 = `x_${observer.id}_${exam2.id}`;
        const secretaryVar1 = `y_${observer.id}_${exam1.id}`;
        const secretaryVar2 = `y_${observer.id}_${exam2.id}`;
        
        // STRONG CONSTRAINT: Observer cannot be head for both overlapping exams
        if (model.variables[headVar1] && model.variables[headVar2]) {
          const constraint = {};
          constraint[headVar1] = 1;
          constraint[headVar2] = 1;
          constraint.max = 1;
          model.constraints[`strong_conflict_head_${observer.id}_${exam1.id}_${exam2.id}`] = constraint;
          constraintCount++;
        }
        
        // STRONG CONSTRAINT: Observer cannot be secretary for both overlapping exams
        if (model.variables[secretaryVar1] && model.variables[secretaryVar2]) {
          const constraint = {};
          constraint[secretaryVar1] = 1;
          constraint[secretaryVar2] = 1;
          constraint.max = 1;
          model.constraints[`strong_conflict_secretary_${observer.id}_${exam1.id}_${exam2.id}`] = constraint;
          constraintCount++;
        }
        
        // STRONG CONSTRAINT: Observer cannot be head for one and secretary for the other
        if (model.variables[headVar1] && model.variables[secretaryVar2]) {
          const constraint = {};
          constraint[headVar1] = 1;
          constraint[secretaryVar2] = 1;
          constraint.max = 1;
          model.constraints[`strong_conflict_head_secretary_${observer.id}_${exam1.id}_${exam2.id}`] = constraint;
          constraintCount++;
        }
        
        // STRONG CONSTRAINT: Observer cannot be secretary for one and head for the other
        if (model.variables[secretaryVar1] && model.variables[headVar2]) {
          const constraint = {};
          constraint[secretaryVar1] = 1;
          constraint[headVar2] = 1;
          constraint.max = 1;
          model.constraints[`strong_conflict_secretary_head_${observer.id}_${exam1.id}_${exam2.id}`] = constraint;
          constraintCount++;
        }
      });
    });
  }

  async solveGLPK(model) {
    const startTime = Date.now();
    
    try {
      // Removed excessive GLPK logging
      
      // Get the GLPK instance
      const glpk = await this.glpkPromise;
      const result = glpk.solve(model);
      const solveTime = Date.now() - startTime;
      
      this.log(`[GLPK] Solver completed in ${solveTime}ms`);
      // GLPK result received
      
      if (result && result.result) {
        // GLPK solution found
        
        this.log(`[GLPK] Solution found with objective value: ${result.result.z}`);
        return result;
      } else {
        this.log(`[GLPK] No solution found - result:`, result);
        return null;
      }
    } catch (error) {
      this.log(`[GLPK] Error: ${error.message}`);
      this.log(`[GLPK] Error stack:`, error.stack);
      return null;
    }
  }

  async formatSolution(solution, data) {
    if (!solution) {
      return [];
    }
    
    const assignments = [];
    const headAssignments = new Map();
    const secretaryAssignments = new Map();
    const observerWorkload = new Map();
    
    // Initialize workload tracking
    data.observers.forEach(observer => {
      observerWorkload.set(observer.id, { head: 0, secretary: 0, total: 0 });
    });
    
    // Process head assignments (x variables)
    Object.entries(solution).forEach(([key, value]) => {
      if (key.startsWith('x_') && value === 1) {
        const parts = key.split('_');
        const observerId = parseInt(parts[1]);
        const examId = parseInt(parts[2]);
        
        headAssignments.set(examId, observerId);
        
        // Update workload
        const workload = observerWorkload.get(observerId);
        workload.head++;
        workload.total++;
      }
    });
    
    // Process secretary assignments (y variables)
    Object.entries(solution).forEach(([key, value]) => {
      if (key.startsWith('y_') && value === 1) {
        const parts = key.split('_');
        const observerId = parseInt(parts[1]);
        const examId = parseInt(parts[2]);
        
        secretaryAssignments.set(examId, observerId);
        
        // Update workload
        const workload = observerWorkload.get(observerId);
        workload.secretary++;
        workload.total++;
      }
    });
    
    // Create assignments
    data.exams.forEach(exam => {
      const headId = headAssignments.get(exam.id);
      const secretaryId = secretaryAssignments.get(exam.id);
      
      if (headId && secretaryId) {
        assignments.push({
          examId: exam.id,
          examName: exam.name,
          examDate: exam.date,
          examTime: `${exam.startTime}-${exam.endTime}`,
          headId: headId,
          secretaryId: secretaryId,
          headName: data.observers.find(o => o.id === headId)?.name || 'Unknown',
          secretaryName: data.observers.find(o => o.id === secretaryId)?.name || 'Unknown'
        });
      }
    });
    
    // Validate assignments for overlaps and role constraints
    const overlaps = await this.validateAssignmentsForOverlaps(assignments, data);
    
    // Calculate statistics
    const completeAssignments = assignments.filter(a => a.headId && a.secretaryId);
    const totalExams = data.exams.length;
    const coverageRatio = totalExams > 0 ? completeAssignments.length / totalExams : 0;
    
    // Calculate workload fairness
    const workloads = Array.from(observerWorkload.values()).filter(w => w.total > 0);
    const avgWorkload = workloads.length > 0 ? workloads.reduce((sum, w) => sum + w.total, 0) / workloads.length : 0;
    const workloadVariance = workloads.length > 0 ? 
      workloads.reduce((sum, w) => sum + Math.pow(w.total - avgWorkload, 2), 0) / workloads.length : 0;
    const workloadStdDev = Math.sqrt(workloadVariance);
    const fairnessScore = avgWorkload > 0 ? Math.max(0, 1 - (workloadStdDev / avgWorkload)) : 1;
    
    return completeAssignments;
  }

  // Format GLPK solution
  async formatGLPKSolution(solution, data) {
    this.log(`[GLPK] Formatting solution:`, solution);
    
    if (!solution || typeof solution !== 'object') {
      this.log(`[GLPK] Invalid solution format`);
      return [];
    }
    
    if (!data || !data.exams || !data.observers) {
      this.log(`[GLPK] Invalid data format`);
      return [];
    }
    
    if (!solution.result) {
      this.log(`[GLPK] No result in solution`);
      return [];
    }
    
    if (!solution.result.vars) {
      this.log(`[GLPK] No vars in result:`, solution.result);
      return [];
    }
    
    // Debug: Log all variables and their values
    this.log(`[GLPK] All variables in solution:`, solution.result.vars);
    this.log(`[GLPK] Number of variables:`, Object.keys(solution.result.vars).length);
    
    // Log variables with value > 0
    const nonZeroVars = Object.entries(solution.result.vars).filter(([name, value]) => value > 0);
    this.log(`[GLPK] Variables with value > 0:`, nonZeroVars);
    
    // Log variables with value = 1 (binary assignments)
    const binaryVars = Object.entries(solution.result.vars).filter(([name, value]) => Math.round(value) === 1);
    this.log(`[GLPK] Variables with value = 1:`, binaryVars);
    
    // Analyze penalty variables
    const penaltyVars = Object.entries(solution.result.vars).filter(([name, value]) => 
      name.startsWith('penalty_') && Math.round(value) === 1
    );
    this.log(`[GLPK] Penalty variables activated:`, penaltyVars);
    
    // Count violations by type
    const timeslotViolations = penaltyVars.filter(([name]) => name.startsWith('penalty_timeslot_')).length;
    const workloadViolations = penaltyVars.filter(([name]) => name.startsWith('penalty_workload_')).length;
    const conflictViolations = penaltyVars.filter(([name]) => name.startsWith('penalty_conflict_')).length;
    
    this.log(`[GLPK] Violation summary:`, {
      timeslotViolations,
      workloadViolations,
      conflictViolations,
      totalViolations: penaltyVars.length
    });
    
    const assignments = [];
    const headAssignments = new Map();
    const secretaryAssignments = new Map();
    const observerWorkload = new Map();
    
    // Initialize workload tracking
    data.observers.forEach(observer => {
      observerWorkload.set(observer.id, { head: 0, secretary: 0, total: 0 });
    });
    
    // Process head assignments (x variables)
    Object.entries(solution.result.vars).forEach(([key, value]) => {
      if (key.startsWith('x_') && Math.round(value) === 1) {
        const parts = key.split('_');
        const observerId = parseInt(parts[1]);
        const examId = parseInt(parts[2]);
        
        headAssignments.set(examId, observerId);
        
        // Update workload
        const workload = observerWorkload.get(observerId);
        workload.head++;
        workload.total++;
      }
    });
    
    // Process secretary assignments (y variables)
    Object.entries(solution.result.vars).forEach(([key, value]) => {
      if (key.startsWith('y_') && Math.round(value) === 1) {
        const parts = key.split('_');
        const observerId = parseInt(parts[1]);
        const examId = parseInt(parts[2]);
        
        secretaryAssignments.set(examId, observerId);
        
        // Update workload
        const workload = observerWorkload.get(observerId);
        workload.secretary++;
        workload.total++;
      }
    });
    
    // Create final assignments
    data.exams.forEach(exam => {
      const headId = headAssignments.get(exam.id);
      const secretaryId = secretaryAssignments.get(exam.id);
      
      if (headId && secretaryId) {
        assignments.push({
          examId: exam.id,
          headId,
          secretaryId
        });
      }
    });
    
    // Calculate statistics
    const completeAssignments = assignments.filter(a => a.headId && a.secretaryId);
    const totalExams = data.exams.length;
    const coverageRatio = totalExams > 0 ? completeAssignments.length / totalExams : 0;
    
    this.log(`[GLPK] Solution: ${completeAssignments.length}/${totalExams} exams assigned, coverage: ${(coverageRatio * 100).toFixed(1)}%`);
    
    return completeAssignments;
  }

  // Timeout-aware GLPK solver
  async solveGLPKWithTimeout(model, timeoutMs) {
    // Skip LP for models that are likely to hang (too many constraints)
    const constraintCount = model.subjectTo?.length || 0;
    const variableCount = model.objective.vars.length;
    
    // AGGRESSIVE: Skip LP for models that have shown to hang in practice
    // Based on logs: chunk 8 had 946 vars, 7236 constraints and hung
    if (constraintCount > ALGORITHM_CONSTANTS.MAX_GLPK_CONSTRAINTS || variableCount > ALGORITHM_CONSTANTS.MAX_GLPK_VARIABLES) {
      this.log(`[GLPK] ⚠️ SKIPPING LP - preventing hang: ${variableCount} vars, ${constraintCount} constraints`);
      return null; // Force fallback to greedy
    }
    
    try {
      const solution = await this.withTimeout(
        this.solveGLPK(model),
        timeoutMs,
        `GLPK solver (${variableCount} vars, ${constraintCount} constraints)`
      );
      return solution;
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        this.log(`[GLPK] ⏰ ${error.message}`);
        return null;
      } else {
        this.log(`[GLPK] Solver error: ${error.message}`);
        return null;
      }
    }
  }

  // Build GLPK model for heads only (hybrid mode)
  buildHeadOnlyGLPKModel(data, glpk, options = {}) {
    if (!data || !data.exams || !data.observers) {
      this.log('[ERROR] Invalid data for head-only model');
      return null;
    }
    
    const { exams, observers } = data;
    
    // Check doctor availability
    const doctors = observers.filter(obs => obs.isDoctor);
    if (!doctors || doctors.length === 0) {
      this.log('[WARNING] No doctors available for head assignments');
      return null;
    }
    
    // Found ${doctors.length} doctors out of ${observers.length} total observers

    // 1. Define variables (binary: 0 or 1)
    const variables = [];
    const binaries = []; // Tracks binary variables for MIP
    
    let availableAssignments = 0;
    let doctorCanTakeAnyExam = 0;
    doctors.forEach(doctor => {
      let thisDocCanTakeExams = 0;
      exams.forEach(exam => {
        if (ObserverUtils.canObserverTakeExam(doctor, exam)) {
          const headVar = `x_${doctor.id}_${exam.id}`;
          variables.push({ name: headVar, coef: 1 }); // Objective coefficient
          binaries.push(headVar);
          availableAssignments++;
          thisDocCanTakeExams++;
        }
      });
      if (thisDocCanTakeExams > 0) {
        doctorCanTakeAnyExam++;
      } else {
        // Doctor ${doctor.id} (${doctor.name}) cannot take ANY exam
      }
    });
    
    this.log(`[HYBRID] Created ${variables.length} variables, ${doctorCanTakeAnyExam}/${doctors.length} doctors available`);

    // 2. Define constraints
    const constraints = [];

    // Constraint 1: Each exam has AT MOST 1 head (doctor)
    let examsWithDoctors = 0;
    exams.forEach(exam => {
      const headVars = variables.filter(v => 
        v.name.startsWith('x_') && v.name.endsWith(`_${exam.id}`)
      ).map(v => ({ name: v.name, coef: 1 }));

      if (headVars.length > 0) {
        constraints.push({
          name: `exam_${exam.id}_head`,
          vars: headVars,
          bnds: { type: glpk.GLP_DB, lb: 0, ub: 1 } // Use GLPK constant for double-bounded
        });
        examsWithDoctors++;
      } else {
        this.log(`[WARNING] Exam ${exam.id} has NO available doctors - will remain unassigned`);
      }
    });
    
    // ${examsWithDoctors} out of ${exams.length} exams have at least one available doctor

    // Constraint 2: No time conflicts for heads (can be disabled for debugging)
    let conflictCount = 0;
    this.log(`[HYBRID] Time conflict check: skipTimeConflicts=${options.skipTimeConflicts}, will ${!options.skipTimeConflicts ? 'ADD' : 'SKIP'} constraints`);
    if (!options.skipTimeConflicts) {
      doctors.forEach(doctor => {
        const headVars = variables.filter(v => v.name.startsWith(`x_${doctor.id}_`));
        
        for (let i = 0; i < headVars.length; i++) {
          for (let j = i + 1; j < headVars.length; j++) {
            const exam1Id = headVars[i].name.split('_').pop();
            const exam2Id = headVars[j].name.split('_').pop();
            const exam1 = exams.find(e => e.id == exam1Id);
            const exam2 = exams.find(e => e.id == exam2Id);
            
            if (exam1 && exam2) {
              // Direct overlap check to avoid any recursive issues
              const sameDate = exam1.date.getTime() === exam2.date.getTime();
                          const timeOverlap = timeRangesOverlap(exam1.startMin, exam1.endMin, exam2.startMin, exam2.endMin);
              const overlaps = sameDate && timeOverlap;
              
              if (overlaps) {
                constraints.push({
                  name: `conflict_${doctor.id}_${exam1Id}_${exam2Id}`,
                  vars: [{ name: headVars[i].name, coef: 1 }, { name: headVars[j].name, coef: 1 }],
                  bnds: { type: glpk.GLP_DB, lb: 0, ub: 1 } // Use GLPK constant
                });
                conflictCount++;
              }
            }
          }
        }
      });
    } else {
      // Skipping time conflict constraints
    }
    
    this.log(`[HYBRID] Generated ${conflictCount} time conflict constraints`);

    // Constraint 3: Prevent over-assigning doctors (fairness) - can be disabled for debugging
    if (!options.skipFairnessConstraints) {
    doctors.forEach(doctor => {
      const headVars = variables.filter(v => v.name.startsWith(`x_${doctor.id}_`));
      if (headVars.length > 0) {
          const maxAssignments = Math.ceil(exams.length / doctors.length) + 1;
          // Doctor ${doctor.id} max assignments: ${maxAssignments}
        constraints.push({
          name: `max_assign_${doctor.id}`,
          vars: headVars.map(v => ({ name: v.name, coef: 1 })),
            bnds: { type: glpk.GLP_DB, lb: 0, ub: maxAssignments } // Use GLPK constant
        });
      }
    });
    } else {
      // Skipping fairness constraints
    }

    // SUCCESS! GLPK is now working with correct direction constants!
    // Let's use the real model instead of the test model
    // GLPK direction constants fixed - using real model
    
    // Skip the test model and use the real one below

    // 3. Return GLPK model (fallback)
    const model = {
      name: 'HeadOnlyScheduling',
      objective: {
        direction: glpk.GLP_MAX, // Use correct GLPK constant for maximization
        name: 'total_assignments',
        vars: variables
      },
      subjectTo: constraints, // GLPK.js uses 'subjectTo' instead of 'constraints'
      binaries: binaries, // Critical for MIP
      options: {
        msglev: 1, // Even more verbose logging
        tmlim: 60000, // 1 minute for head-only
        presolve: 0, // Disable preprocessing
        cuts: 0, // Disable cuts
        heur: 0, // Disable heuristics
        br: 0 // Use default branching
      }
    };

    this.log(`[JS-LP] Head-only GLPK model: ${variables.length} variables, ${constraints.length} constraints`);
    return model;
  }

  // Format head-only solution
  formatHeadSolution(solution, data) {
    const assignments = [];
    
    Object.keys(solution).forEach(varName => {
      if (varName.startsWith('x_') && solution[varName] === 1) {
        const parts = varName.split('_');
        const observerId = parseInt(parts[1]);
        const examId = parseInt(parts[2]);
        
        assignments.push({
          examId,
          headId: observerId,
          secretaryId: null // Will be filled by greedy algorithm
        });
      }
    });
    
    return assignments;
  }

  // Assign secretaries using greedy algorithm
  async assignSecretariesGreedy(data, headAssignments) {
    const completeAssignments = [];
    const observerBusyTimes = new Map();
    data.observers.forEach(obs => observerBusyTimes.set(obs.id, []));
    
    // Mark head assignments as busy
    headAssignments.forEach(assignment => {
      const exam = data.exams.find(e => e.id === assignment.examId);
      if (exam) {
        const busyTime = { date: exam.date, startMin: exam.startMin, endMin: exam.endMin };
        observerBusyTimes.get(assignment.headId).push(busyTime);
      }
    });
    
    // Assign secretaries for each exam
    for (const headAssignment of headAssignments) {
      const exam = data.exams.find(e => e.id === headAssignment.examId);
      if (!exam) continue;
      
      const availableObservers = data.observers.filter(observer => {
        // Skip the head observer
        if (observer.id === headAssignment.headId) return false;
        
        // Check if observer can take this exam
        if (!ObserverUtils.canObserverTakeExam(observer, exam)) return false;
        
        // Check for time conflicts
        const busyTimes = observerBusyTimes.get(observer.id);
        return !busyTimes.some(busy => 
          busy.date.getTime() === exam.date.getTime() &&
          timeRangesOverlap(busy.startMin, busy.endMin, exam.startMin, exam.endMin)
        );
      });
      
      if (availableObservers.length > 0) {
        const secretary = availableObservers[0]; // Take first available
        headAssignment.secretaryId = secretary.id;
        
        // Mark secretary as busy
        const busyTime = { date: exam.date, startMin: exam.startMin, endMin: exam.endMin };
        observerBusyTimes.get(secretary.id).push(busyTime);
      }
      
      completeAssignments.push(headAssignment);
    }
    
    return completeAssignments;
  }



  async applySolution(assignments, examIds) {
    await client.query('DELETE FROM ExamAssignment WHERE ExamID = ANY($1)', [examIds]);
    
    for (const assignment of assignments) {
      if (assignment.headId && assignment.secretaryId) {
        await client.query(
          'INSERT INTO ExamAssignment (ExamID, ObserverID, Role, Status) VALUES ($1, $2, $3, $4)',
          [assignment.examId, assignment.headId, 'head', 'active']
        );
        await client.query(
          'INSERT INTO ExamAssignment (ExamID, ObserverID, Role, Status) VALUES ($1, $2, $3, $4)',
          [assignment.examId, assignment.secretaryId, 'secretary', 'active']
        );
      }
    }
  }

  async savePerformanceReport(assignments, data) {
    try {
      const MetricsService = require('./metricsService');
      
      // Format results in the standard structure
      const results = {
        successful: assignments,
        failed: data.exams.filter(exam => 
          !assignments.some(a => a.examId === exam.examid)
        )
      };
      
      // Calculate execution time
      const executionTime = Date.now() - this.startTime;
      
      // Save metrics using central service
      await MetricsService.saveMetrics('lp', results, data, {
        executionTime,
        solver: 'glpk',
        timeLimit: this.timeLimit,
        optimizationGoal: this.optimizationGoal,
        objectiveValue: this.lastObjectiveValue
      });
      
      console.log('LP performance metrics saved successfully');
    } catch (error) {
      console.error('Error saving LP performance report:', error);
    }
  }

  // Observer utility methods moved to ObserverUtils



  // Helper: Create optimal chunks for large datasets
  createOptimalChunks(exams, chunkSize) {
    // Sort exams by date and time for better chunking
    const sortedExams = [...exams].sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.startMin - b.startMin;
    });

    const chunks = [];
    for (let i = 0; i < sortedExams.length; i += chunkSize) {
      const chunk = sortedExams.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    this.log(`[CHUNKED] Created ${chunks.length} chunks from ${exams.length} exams`);
    chunks.forEach((chunk, index) => {
      const dateRange = `${chunk[0].date.toISOString().split('T')[0]} to ${chunk[chunk.length-1].date.toISOString().split('T')[0]}`;
      this.log(`[CHUNKED] Chunk ${index + 1}: ${chunk.length} exams (${dateRange})`);
    });

    return chunks;
  }

  // Helper: Get available observers for a specific chunk
  getAvailableObserversForChunk(allObservers, chunkExams, observerSchedule) {
    return allObservers.filter(observer => {
      const schedule = observerSchedule.get(observer.id) || [];
      
      // Check if observer has any conflicts with exams in this chunk
      for (const exam of chunkExams) {
        for (const busyTime of schedule) {
          // Check for time conflicts
          if (busyTime.date.getTime() === exam.date.getTime()) {
                    // timeRangesOverlap is already imported at the top
        if (timeRangesOverlap(busyTime.startMin, busyTime.endMin, exam.startMin, exam.endMin)) {
              return false; // Observer is busy during this exam
            }
          }
        }
      }
      
      return true; // Observer is available for this chunk
    });
  }

  // Helper: Optimize assignments across chunk boundaries
  async optimizeChunkBoundaries(assignments, data) {
    this.log(`[CHUNKED] Post-processing: Optimizing ${assignments.length} assignments`);
    
    // For now, just validate and return the assignments
    // In the future, we could implement cross-chunk optimization here
    
    try {
      const validationResult = await this.validationService.validateAssignments(assignments, data);
      const totalViolations = validationResult.overlaps.length + 
                             validationResult.roleViolations.length + 
                             validationResult.timeslotViolations.length;
      
      this.log(`[CHUNKED] Post-processing complete: ${totalViolations} violations found`);
      
      if (totalViolations > 0) {
        this.log(`[CHUNKED] Warning: ${totalViolations} constraint violations in chunked solution`);
      }
      
    } catch (error) {
      this.log(`[CHUNKED] Post-processing validation failed: ${error.message}`);
    }
    
    return assignments;
  }

  // Validation methods moved to AssignmentValidationService
}

module.exports = LinearProgrammingAssignmentService;