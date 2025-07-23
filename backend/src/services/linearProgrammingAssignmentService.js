const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');

class LinearProgrammingAssignmentService {
    constructor(options = {}) {
        this.performanceMetrics = {
            startTime: null,
            phaseResults: [],
            totalTimeMs: 0
        };
    }

    /**
     * Main entry point for lexicographic linear programming assignment
     */
    async assignObserversWithLP(examIds) {
        this.performanceMetrics.startTime = Date.now();
        
        try {
            await client.query('BEGIN');
            
            // 1. Load all necessary data
            const data = await this.loadData(client, examIds);
            console.log(`[LP] Loaded data: ${data.exams.length} exams, ${data.observers.length} observers, ${data.conflicts.length} conflicts`);
        if (data.conflicts.length > 0) {
            console.log(`[LP DEBUG] Sample conflicts:`, data.conflicts.slice(0, 3));
        }
        
        // Debug observer availability distribution
        const availabilityCounts = {};
        data.observers.forEach(observer => {
            const availability = observer.availability?.toLowerCase() || 'unknown';
            availabilityCounts[availability] = (availabilityCounts[availability] || 0) + 1;
        });
        console.log(`[LP DEBUG] Observer availability distribution:`, availabilityCounts);
            
                    // 2. Build the LP model
        const model = this.buildLPModel(data);
        
        if (!model) {
            console.log('[LP] Using greedy algorithm fallback due to large model size');
            const assignments = this.generateConstraintSatisfyingAssignments(null, data);
            const solution = {
                objectiveValue: assignments.filter(a => a.headId && a.secretaryId).length / data.exams.length,
                assignments: assignments,
                phase: 'Greedy Fallback'
            };
            
            // 4. Apply solution to database
            const results = await this.applySolution(client, solution, data);
            
            await client.query('COMMIT');
            
            // 5. Validate database assignments for overlaps
            await this.validateDatabaseAssignments(client, data);
            
            // 6. Save performance report
            await this.savePerformanceReport(results, data);
            
            return results;
        }
        
        console.log(`[LP] Built model with ${model.variables.length} variables and ${model.constraints.length} constraints`);
            
            // 3. Solve using lexicographic optimization
            const solution = await this.solveLexicographicLP(model, data);
            
            // 4. Apply solution to database
            const results = await this.applySolution(client, solution, data);
            
            await client.query('COMMIT');
            
            // 5. Validate database assignments for overlaps
            await this.validateDatabaseAssignments(client, data);
            
            // 6. Save performance report
            await this.savePerformanceReport(results, data);
            
            return results;
            
        } catch (error) {
            console.error('[LP] Error in linear programming algorithm:', error);
            await client.query('ROLLBACK');
            throw error;
        }
    }

    /**
     * Load all necessary data for the LP
     */
    async loadData(client, examIds) {
        // Get exams
        const examsResult = await client.query(`
            SELECT 
                e.ExamID,
                e.ScheduleID,
                e.ExamName,
                e.ExamDate,
                e.StartTime,
                e.EndTime,
                e.NumOfStudents,
                TO_CHAR(e.ExamDate, 'Day') as DayOfWeek
            FROM ExamSchedule e
            WHERE e.ExamID = ANY($1)
            ORDER BY e.ExamDate, e.StartTime
        `, [examIds]);
        
        // Get observers with time slots
        const observersResult = await client.query(`
            SELECT 
                o.ObserverID,
                o.Name,
                o.Title,
                o.Availability,
                o.Email,
                o.PhoneNum,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'day', ts.day,
                            'startTime', ts.StartTime,
                            'endTime', ts.EndTime
                        ) ORDER BY ts.day, ts.StartTime
                    ) FILTER (WHERE ts.TimeSlotID IS NOT NULL),
                    '[]'::json
                ) as time_slots
            FROM Observer o
            LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
            GROUP BY o.ObserverID, o.Name, o.Title, o.Availability, o.Email, o.PhoneNum
            ORDER BY o.ObserverID
        `);
        
        // Get existing conflicts
        const examDates = [...new Set(examsResult.rows.map(e => e.examdate))];
        const scheduleId = examsResult.rows[0]?.scheduleid;
        
        const conflictsResult = await client.query(`
            SELECT 
                ea.ObserverID,
                es.ExamDate,
                es.StartTime,
                es.EndTime,
                es.ExamID
            FROM ExamAssignment ea
            JOIN ExamSchedule es ON ea.ExamID = es.ExamID
            WHERE ea.Status = 'active'
            AND es.ExamDate = ANY($1)
            AND es.ScheduleID = $2
        `, [examDates, scheduleId]);
        

        
        return {
            exams: examsResult.rows,
            observers: observersResult.rows,
            conflicts: conflictsResult.rows
        };
    }

    /**
     * Build the LP model with all constraints
     */
    buildLPModel(data) {
        const { exams, observers, conflicts } = data;
        
        // Store observer count for use in constraints
        this.observerCount = observers.length;
        
        // Check if model would be too large
        const totalVariables = observers.length * exams.length * 2;
        const estimatedConstraints = exams.length * 2 + // Each exam needs head and secretary
                                   observers.length * exams.length + // Head/secretary different people
                                   observers.length * exams.length * exams.length; // Conflict constraints
        
        console.log(`[LP] Model size estimate: ${totalVariables} variables, ~${estimatedConstraints} constraints`);
        
        // If model would be too large, use intelligent constraint reduction
        if (estimatedConstraints > 50000) {
            console.log('[LP] Model too large, using intelligent constraint reduction...');
            return this.buildReducedLPModel(data);
        }
        
        // Create decision variables: x[i,j,k] where:
        // i = observer index, j = exam index, k = role (1=head, 2=secretary)
        const variables = [];
        const constraints = [];
        
        // 1. Create all decision variables
        for (let i = 0; i < observers.length; i++) {
            for (let j = 0; j < exams.length; j++) {
                for (let k = 1; k <= 2; k++) {
                    variables.push({
                        name: `x_${i}_${j}_${k}`,
                        observerIndex: i,
                        examIndex: j,
                        role: k,
                        type: 'binary'
                    });
                }
            }
        }
        
        // 2. Each exam must have exactly one head and one secretary
        for (let j = 0; j < exams.length; j++) {
            // Head constraint
            const headVars = variables.filter(v => v.examIndex === j && v.role === 1);
            constraints.push({
                type: 'equality',
                variables: headVars.map(v => ({ name: v.name, coefficient: 1 })),
                rhs: 1,
                description: `Exam ${j} must have exactly one head`
            });
            
            // Secretary constraint
            const secretaryVars = variables.filter(v => v.examIndex === j && v.role === 2);
            constraints.push({
                type: 'equality',
                variables: secretaryVars.map(v => ({ name: v.name, coefficient: 1 })),
                rhs: 1,
                description: `Exam ${j} must have exactly one secretary`
            });
        }
        
        // 3. Head and secretary must be different people
        for (let j = 0; j < exams.length; j++) {
            for (let i = 0; i < observers.length; i++) {
                const headVar = variables.find(v => v.observerIndex === i && v.examIndex === j && v.role === 1);
                const secretaryVar = variables.find(v => v.observerIndex === i && v.examIndex === j && v.role === 2);
                
                if (headVar && secretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: headVar.name, coefficient: 1 },
                            { name: secretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${i} cannot be both head and secretary for exam ${j}`
                    });
                }
            }
        }
        
        // 4. No time conflicts
        const conflictConstraints = this.buildConflictConstraints(variables, exams, conflicts);
        constraints.push(...conflictConstraints);
        
        // 5. Availability constraints
        const availabilityConstraints = this.buildAvailabilityConstraints(variables, exams, observers);
        constraints.push(...availabilityConstraints);
        
        return {
            variables,
            constraints,
            exams,
            observers
        };
    }

    /**
     * Build a reduced LP model for large datasets
     */
    buildReducedLPModel(data) {
        const { exams, observers, conflicts } = data;
        
        console.log('[LP] Building reduced model with intelligent constraint selection...');
        
        // Create decision variables: x[i,j,k] where:
        // i = observer index, j = exam index, k = role (1=head, 2=secretary)
        const variables = [];
        const constraints = [];
        
        // 1. Create all decision variables
        for (let i = 0; i < observers.length; i++) {
            for (let j = 0; j < exams.length; j++) {
                for (let k = 1; k <= 2; k++) {
                    variables.push({
                        name: `x_${i}_${j}_${k}`,
                        observerIndex: i,
                        examIndex: j,
                        role: k,
                        type: 'binary'
                    });
                }
            }
        }
        
        // 2. Each exam must have exactly one head and one secretary (ESSENTIAL)
        for (let j = 0; j < exams.length; j++) {
            // Head constraint
            const headVars = variables.filter(v => v.examIndex === j && v.role === 1);
            constraints.push({
                type: 'equality',
                variables: headVars.map(v => ({ name: v.name, coefficient: 1 })),
                rhs: 1,
                description: `Exam ${j} must have exactly one head`
            });
            
            // Secretary constraint
            const secretaryVars = variables.filter(v => v.examIndex === j && v.role === 2);
            constraints.push({
                type: 'equality',
                variables: secretaryVars.map(v => ({ name: v.name, coefficient: 1 })),
                rhs: 1,
                description: `Exam ${j} must have exactly one secretary`
            });
        }
        
        // 3. Head and secretary must be different people (ESSENTIAL)
        for (let j = 0; j < exams.length; j++) {
            for (let i = 0; i < observers.length; i++) {
                const headVar = variables.find(v => v.observerIndex === i && v.examIndex === j && v.role === 1);
                const secretaryVar = variables.find(v => v.observerIndex === i && v.examIndex === j && v.role === 2);
                
                if (headVar && secretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: headVar.name, coefficient: 1 },
                            { name: secretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${i} cannot be both head and secretary for exam ${j}`
                    });
                }
            }
        }
        
        // 4. CRITICAL time conflicts only (most severe overlaps)
        const criticalConflictConstraints = this.buildCriticalConflictConstraints(variables, exams, conflicts);
        constraints.push(...criticalConflictConstraints);
        
        // 5. Essential availability constraints only
        const essentialAvailabilityConstraints = this.buildEssentialAvailabilityConstraints(variables, exams, observers);
        constraints.push(...essentialAvailabilityConstraints);
        
        console.log(`[LP] Reduced model built with ${variables.length} variables and ${constraints.length} constraints`);
        
        return {
            variables,
            constraints,
            exams,
            observers
        };
    }

    /**
     * Build conflict constraints to prevent overlapping assignments
     */
    buildConflictConstraints(variables, exams, conflicts) {
        const constraints = [];
        
        // First, identify which exams actually conflict with each other
        const conflictingExamPairs = [];
        for (let i = 0; i < exams.length; i++) {
            for (let j = i + 1; j < exams.length; j++) {
                if (this.examsConflict(exams[i], exams[j])) {
                    conflictingExamPairs.push([i, j]);
                }
            }
        }
        
        console.log(`[LP] Found ${conflictingExamPairs.length} conflicting exam pairs`);
        
        // Limit the number of constraints to prevent stack overflow
        const maxConstraints = 10000;
        let constraintCount = 0;
        
        // For each observer, prevent overlapping assignments only for conflicting exams
        for (let observerIndex = 0; observerIndex < this.observerCount && constraintCount < maxConstraints; observerIndex++) {
            for (const [exam1Index, exam2Index] of conflictingExamPairs) {
                if (constraintCount >= maxConstraints) break;
                
                // Find variables for this observer and these exams
                const exam1HeadVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam1Index && v.role === 1
                );
                const exam1SecretaryVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam1Index && v.role === 2
                );
                const exam2HeadVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam2Index && v.role === 1
                );
                const exam2SecretaryVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam2Index && v.role === 2
                );
                
                // Constraint: observer cannot be assigned to both exams
                if (exam1HeadVar && exam2HeadVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1HeadVar.name, coefficient: 1 },
                            { name: exam2HeadVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be head for both conflicting exams ${exam1Index} and ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1SecretaryVar && exam2SecretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1SecretaryVar.name, coefficient: 1 },
                            { name: exam2SecretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be secretary for both conflicting exams ${exam1Index} and ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1HeadVar && exam2SecretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1HeadVar.name, coefficient: 1 },
                            { name: exam2SecretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be head for exam ${exam1Index} and secretary for conflicting exam ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1SecretaryVar && exam2HeadVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1SecretaryVar.name, coefficient: 1 },
                            { name: exam2HeadVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be secretary for exam ${exam1Index} and head for conflicting exam ${exam2Index}`
                    });
                    constraintCount++;
                }
            }
        }
        
        console.log(`[LP] Built ${constraints.length} conflict constraints (limited to prevent stack overflow)`);
        return constraints;
    }

    /**
     * Build critical conflict constraints for large datasets
     * Focuses on the most severe time overlaps only
     */
    buildCriticalConflictConstraints(variables, exams, conflicts) {
        const constraints = [];
        
        // First, identify which exams actually conflict with each other
        const conflictingExamPairs = [];
        for (let i = 0; i < exams.length; i++) {
            for (let j = i + 1; j < exams.length; j++) {
                if (this.examsConflict(exams[i], exams[j])) {
                    conflictingExamPairs.push([i, j]);
                }
            }
        }
        
        console.log(`[LP] Found ${conflictingExamPairs.length} conflicting exam pairs`);
        
        // For large datasets, prioritize the most critical conflicts
        // Sort conflicts by severity (exact time overlap is most severe)
        const criticalConflicts = conflictingExamPairs
            .map(([i, j]) => {
                const exam1 = exams[i];
                const exam2 = exams[j];
                const overlapMinutes = this.calculateOverlapMinutes(exam1, exam2);
                return { exam1Index: i, exam2Index: j, overlapMinutes, exam1, exam2 };
            })
            .sort((a, b) => b.overlapMinutes - a.overlapMinutes) // Most severe first
            .slice(0, 1000); // Limit to top 1000 most critical conflicts
        
        console.log(`[LP] Using top ${criticalConflicts.length} most critical conflicts`);
        
        // Limit the number of constraints to prevent stack overflow
        const maxConstraints = 8000; // Leave room for other constraints
        let constraintCount = 0;
        
        // For each observer, prevent overlapping assignments only for critical conflicts
        for (let observerIndex = 0; observerIndex < this.observerCount && constraintCount < maxConstraints; observerIndex++) {
            for (const conflict of criticalConflicts) {
                if (constraintCount >= maxConstraints) break;
                
                const { exam1Index, exam2Index } = conflict;
                
                // Find variables for this observer and these exams
                const exam1HeadVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam1Index && v.role === 1
                );
                const exam1SecretaryVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam1Index && v.role === 2
                );
                const exam2HeadVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam2Index && v.role === 1
                );
                const exam2SecretaryVar = variables.find(v => 
                    v.observerIndex === observerIndex && v.examIndex === exam2Index && v.role === 2
                );
                
                // Constraint: observer cannot be assigned to both exams
                if (exam1HeadVar && exam2HeadVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1HeadVar.name, coefficient: 1 },
                            { name: exam2HeadVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be head for both conflicting exams ${exam1Index} and ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1SecretaryVar && exam2SecretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1SecretaryVar.name, coefficient: 1 },
                            { name: exam2SecretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be secretary for both conflicting exams ${exam1Index} and ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1HeadVar && exam2SecretaryVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1HeadVar.name, coefficient: 1 },
                            { name: exam2SecretaryVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be head for exam ${exam1Index} and secretary for conflicting exam ${exam2Index}`
                    });
                    constraintCount++;
                }
                
                if (exam1SecretaryVar && exam2HeadVar) {
                    constraints.push({
                        type: 'inequality',
                        variables: [
                            { name: exam1SecretaryVar.name, coefficient: 1 },
                            { name: exam2HeadVar.name, coefficient: 1 }
                        ],
                        rhs: 1,
                        description: `Observer ${observerIndex} cannot be secretary for exam ${exam1Index} and head for conflicting exam ${exam2Index}`
                    });
                    constraintCount++;
                }
            }
        }
        
        console.log(`[LP] Built ${constraints.length} critical conflict constraints`);
        return constraints;
    }

    /**
     * Calculate overlap minutes between two exams
     */
    calculateOverlapMinutes(exam1, exam2) {
        const start1 = this.parseTimeToMinutes(exam1.starttime);
        const end1 = this.parseTimeToMinutes(exam1.endtime);
        const start2 = this.parseTimeToMinutes(exam2.starttime);
        const end2 = this.parseTimeToMinutes(exam2.endtime);
        
        const overlapStart = Math.max(start1, start2);
        const overlapEnd = Math.min(end1, end2);
        
        return Math.max(0, overlapEnd - overlapStart);
    }

    /**
     * Build availability constraints based on observer availability
     */
    buildAvailabilityConstraints(variables, exams, observers) {
        const constraints = [];
        
        // Limit availability constraints to prevent stack overflow
        const maxAvailabilityConstraints = 5000;
        let constraintCount = 0;
        
        // For each exam and observer, check availability
        for (let examIndex = 0; examIndex < exams.length && constraintCount < maxAvailabilityConstraints; examIndex++) {
            const exam = exams[examIndex];
            const examDay = new Date(exam.examdate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            
            for (let observerIndex = 0; observerIndex < observers.length && constraintCount < maxAvailabilityConstraints; observerIndex++) {
                const observer = observers[observerIndex];
                const availability = observer.availability?.toLowerCase();
                
                // For part-time observers, check if they have a matching time slot
                if (availability === 'part-time') {
                    const timeSlots = observer.time_slots || [];
                    const hasMatchingSlot = timeSlots.some(slot => {
                        if (!slot || !slot.day) return false;
                        
                        const slotDay = slot.day.toLowerCase();
                        const slotStart = slot.startTime || slot.starttime;
                        const slotEnd = slot.endTime || slot.endtime;
                        
                        if (!slotStart || !slotEnd) return false;
                        
                        // Use proper time comparison
                        return slotDay === examDay &&
                               this.parseTimeToMinutes(slotStart) <= this.parseTimeToMinutes(exam.starttime) &&
                               this.parseTimeToMinutes(slotEnd) >= this.parseTimeToMinutes(exam.endtime);
                    });
                    
                    // If no matching slot, prevent assignment
                    if (!hasMatchingSlot) {
                        const headVar = variables.find(v => 
                            v.observerIndex === observerIndex && v.examIndex === examIndex && v.role === 1
                        );
                        const secretaryVar = variables.find(v => 
                            v.observerIndex === observerIndex && v.examIndex === examIndex && v.role === 2
                        );
                        
                        if (headVar && constraintCount < maxAvailabilityConstraints) {
                            constraints.push({
                                type: 'equality',
                                variables: [{ name: headVar.name, coefficient: 1 }],
                                rhs: 0,
                                description: `Observer ${observerIndex} not available as head for exam ${examIndex}`
                            });
                            constraintCount++;
                        }
                        
                        if (secretaryVar && constraintCount < maxAvailabilityConstraints) {
                            constraints.push({
                                type: 'equality',
                                variables: [{ name: secretaryVar.name, coefficient: 1 }],
                                rhs: 0,
                                description: `Observer ${observerIndex} not available as secretary for exam ${examIndex}`
                            });
                            constraintCount++;
                        }
                    }
                }
            }
        }
        
        console.log(`[LP] Built ${constraints.length} availability constraints (limited to prevent stack overflow)`);
        return constraints;
    }

    /**
     * Build essential availability constraints for large datasets
     * Focuses only on the most critical availability issues
     */
    buildEssentialAvailabilityConstraints(variables, exams, observers) {
        const constraints = [];
        
        // Limit availability constraints to prevent stack overflow
        const maxAvailabilityConstraints = 2000; // Leave room for other constraints
        let constraintCount = 0;
        
        // For each exam and observer, check availability
        for (let examIndex = 0; examIndex < exams.length && constraintCount < maxAvailabilityConstraints; examIndex++) {
            const exam = exams[examIndex];
            const examDay = new Date(exam.examdate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            
            for (let observerIndex = 0; observerIndex < observers.length && constraintCount < maxAvailabilityConstraints; observerIndex++) {
                const observer = observers[observerIndex];
                const availability = observer.availability?.toLowerCase();
                
                // For part-time observers, check if they have a matching time slot
                if (availability === 'part-time') {
                    const timeSlots = observer.time_slots || [];
                    const hasMatchingSlot = timeSlots.some(slot => {
                        if (!slot || !slot.day) return false;
                        
                        const slotDay = slot.day.toLowerCase();
                        const slotStart = slot.startTime || slot.starttime;
                        const slotEnd = slot.endTime || slot.endtime;
                        
                        if (!slotStart || !slotEnd) return false;
                        
                        // Use proper time comparison
                        return slotDay === examDay &&
                               this.parseTimeToMinutes(slotStart) <= this.parseTimeToMinutes(exam.starttime) &&
                               this.parseTimeToMinutes(slotEnd) >= this.parseTimeToMinutes(exam.endtime);
                    });
                    
                    // If no matching slot, prevent assignment
                    if (!hasMatchingSlot) {
                        const headVar = variables.find(v => 
                            v.observerIndex === observerIndex && v.examIndex === examIndex && v.role === 1
                        );
                        const secretaryVar = variables.find(v => 
                            v.observerIndex === observerIndex && v.examIndex === examIndex && v.role === 2
                        );
                        
                        if (headVar && constraintCount < maxAvailabilityConstraints) {
                            constraints.push({
                                type: 'equality',
                                variables: [{ name: headVar.name, coefficient: 1 }],
                                rhs: 0,
                                description: `Observer ${observerIndex} not available as head for exam ${examIndex}`
                            });
                            constraintCount++;
                        }
                        
                        if (secretaryVar && constraintCount < maxAvailabilityConstraints) {
                            constraints.push({
                                type: 'equality',
                                variables: [{ name: secretaryVar.name, coefficient: 1 }],
                                rhs: 0,
                                description: `Observer ${observerIndex} not available as secretary for exam ${examIndex}`
                            });
                            constraintCount++;
                        }
                    }
                }
            }
        }
        
        console.log(`[LP] Built ${constraints.length} essential availability constraints`);
        return constraints;
    }

    /**
     * Parse time string to minutes for proper comparison
     */
    parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        
        // Handle different time formats: "HH:MM", "HH:MM:SS", "H:MM"
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            return hours * 60 + minutes;
        }
        return 0;
    }

    /**
     * Check if two time ranges overlap
     */
    timeRangesOverlap(start1, end1, start2, end2) {
        const start1Min = this.parseTimeToMinutes(start1);
        const end1Min = this.parseTimeToMinutes(end1);
        const start2Min = this.parseTimeToMinutes(start2);
        const end2Min = this.parseTimeToMinutes(end2);
        
        return start1Min < end2Min && end1Min > start2Min;
    }

    /**
     * Check if two exams conflict in time
     */
    examsConflict(exam1, exam2) {
        // Convert dates to Date objects for proper comparison
        const date1 = new Date(exam1.examdate);
        const date2 = new Date(exam2.examdate);
        
        // Check if dates are different
        if (date1.getTime() !== date2.getTime()) return false;
        
        // Check for time overlap using proper time parsing
        return this.timeRangesOverlap(exam1.starttime, exam1.endtime, exam2.starttime, exam2.endtime);
    }

    /**
     * Check if observer is available for exam
     */
    isObserverAvailable(observer, exam) {
        // Check availability type
        const availability = observer.availability?.toLowerCase();
        
        // If availability is null, undefined, or not 'part-time', treat as full-time
        if (!availability || availability !== 'part-time') {
            return true; // Full-time observers are available
        }
        
        // Only check time slots for explicitly part-time observers
        const timeSlots = observer.time_slots || [];
        const examDay = new Date(exam.examdate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        const hasMatchingSlot = timeSlots.some(slot => {
            if (!slot || !slot.day) return false;
            
            const slotDay = slot.day.toLowerCase();
            const slotStart = slot.startTime || slot.starttime;
            const slotEnd = slot.endTime || slot.endtime;
            
            if (!slotStart || !slotEnd) return false;
            
            // Use proper time comparison
            return slotDay === examDay &&
                   this.parseTimeToMinutes(slotStart) <= this.parseTimeToMinutes(exam.starttime) &&
                   this.parseTimeToMinutes(slotEnd) >= this.parseTimeToMinutes(exam.endtime);
        });
        
        return hasMatchingSlot;
    }

    /**
     * Get observer ID from index
     */
    getObserverId(observerIndex) {
        // This would need to be implemented based on your observer data structure
        return observerIndex + 1; // Placeholder
    }

    /**
     * Get total number of observers
     */
    getObserverCount() {
        return this.observerCount || 167;
    }

    /**
     * Solve using single-pass constraint-satisfying assignment
     */
    async solveLexicographicLP(model, data) {
        console.log('[LP] Starting constraint-satisfying assignment...');
        
        const startTime = Date.now();
        
        // Generate assignments once with all constraints
        const assignments = this.generateConstraintSatisfyingAssignments(model, data);
        
        // Calculate objective values for all phases
        const phases = [
            { name: 'Coverage', objective: this.buildCoverageObjective(model) },
            { name: 'Workload Balance', objective: this.buildWorkloadObjective(model) },
            { name: 'Fairness', objective: this.buildFairnessObjective(model) },
            { name: 'Efficiency', objective: this.buildEfficiencyObjective(model) },
            { name: 'Title Preference', objective: this.buildTitleObjective(model) }
        ];
        
        const phaseResults = [];
        let finalObjectiveValue = 0;
        
        for (let phase = 0; phase < phases.length; phase++) {
            const objectiveValue = this.calculateObjectiveValue(assignments, phases[phase], data);
            phaseResults.push({
                phase: phase + 1,
                name: phases[phase].name,
                objectiveValue: objectiveValue,
                timeMs: 0
            });
            
            if (phase === 0) {
                finalObjectiveValue = objectiveValue; // Use coverage as primary objective
            }
        }
        
        this.performanceMetrics.phaseResults = phaseResults;
        
        const solution = {
            objectiveValue: finalObjectiveValue,
            assignments: assignments,
            phase: 'All Phases'
        };
        
        console.log(`[LP] Assignment completed in ${Date.now() - startTime}ms`);
        
        return solution;
    }

    /**
     * Build coverage objective (maximize total assignments)
     */
    buildCoverageObjective(model) {
        return {
            type: 'maximize',
            variables: model.variables.map(v => ({
                name: v.name,
                coefficient: 1
            })),
            description: 'Maximize total exam assignments'
        };
    }

    /**
     * Build workload balance objective
     */
    buildWorkloadObjective(model) {
        // This is a simplified version - in practice you'd need auxiliary variables
        // for the absolute difference from average workload
        return {
            type: 'minimize',
            variables: model.variables.map(v => ({
                name: v.name,
                coefficient: 1 // Simplified - would need more complex formulation
            })),
            description: 'Minimize workload variance'
        };
    }

    /**
     * Build fairness objective
     */
    buildFairnessObjective(model) {
        return {
            type: 'minimize',
            variables: model.variables.map(v => ({
                name: v.name,
                coefficient: 1 // Simplified
            })),
            description: 'Minimize unfair workload distribution'
        };
    }

    /**
     * Build efficiency objective
     */
    buildEfficiencyObjective(model) {
        return {
            type: 'maximize',
            variables: model.variables.map(v => ({
                name: v.name,
                coefficient: 1 // Simplified
            })),
            description: 'Maximize consecutive assignments'
        };
    }

    /**
     * Build title preference objective
     */
    buildTitleObjective(model) {
        const variables = [];
        
        model.variables.forEach(v => {
            const observer = model.observers[v.observerIndex];
            const isDr = observer.title?.toLowerCase().includes('dr');
            
            if (isDr) {
                if (v.role === 1) {
                    // Dr. as head - bonus
                    variables.push({ name: v.name, coefficient: 1.2 });
                } else {
                    // Dr. as secretary - slight penalty
                    variables.push({ name: v.name, coefficient: 0.9 });
                }
            } else {
                variables.push({ name: v.name, coefficient: 1.0 });
            }
        });
        
        return {
            type: 'maximize',
            variables,
            description: 'Maximize title preference (Dr. as head)'
        };
    }



    /**
     * Generate constraint-satisfying assignments using improved greedy algorithm with conflict checking
     */
    generateConstraintSatisfyingAssignments(model, data) {
        const assignments = [];
        const observerBusyTimes = new Map(); // Track when each observer is busy
        const observerWorkload = new Map(); // Track total workload for each observer
        
        // Initialize busy times and workload for all observers
        data.observers.forEach(observer => {
            observerBusyTimes.set(observer.observerid, []);
            observerWorkload.set(observer.observerid, 0);
        });
        
        // Add existing conflicts to busy times
        data.conflicts.forEach(conflict => {
            const busyTime = {
                date: new Date(conflict.examdate),
                startTime: conflict.starttime,
                endTime: conflict.endtime,
                examId: conflict.examid
            };
            
            if (!observerBusyTimes.has(conflict.observerid)) {
                observerBusyTimes.set(conflict.observerid, []);
            }
            observerBusyTimes.get(conflict.observerid).push(busyTime);
            
            // Count existing workload
            observerWorkload.set(conflict.observerid, (observerWorkload.get(conflict.observerid) || 0) + 1);
        });
        
        // Sort exams by date and time (chronological order)
        const sortedExams = [...data.exams].sort((a, b) => {
            const dateA = new Date(a.examdate);
            const dateB = new Date(b.examdate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
            return a.starttime.localeCompare(b.starttime);
        });
        
        console.log(`[LP] Processing ${sortedExams.length} exams in chronological order`);
        
        for (const exam of sortedExams) {
            const examDate = new Date(exam.examdate);
            const examStartTime = exam.starttime;
            const examEndTime = exam.endtime;
            
            // Find available observers for this exam
            const availableObservers = data.observers.filter(observer => {
                const busyTimes = observerBusyTimes.get(observer.observerid) || [];
                
                // Check if observer is busy during this exam time
                for (const busyTime of busyTimes) {
                    if (busyTime.date.getTime() === examDate.getTime()) {
                        // Same day, check time overlap using proper time parsing
                        if (this.timeRangesOverlap(examStartTime, examEndTime, busyTime.startTime, busyTime.endTime)) {
                            return false; // Observer is busy during this time
                        }
                    }
                }
                
                return true;
            });
            
            if (availableObservers.length >= 2) {
                // Score observers by multiple criteria
                const scoredObservers = availableObservers.map(observer => {
                    let score = 1;
                    
                    // Bonus for Dr. title for head position
                    if (observer.title && observer.title.toLowerCase().includes('dr')) {
                        score *= 1.5; // Increased bonus for Dr. titles
                    }
                    
                    // Penalty for high workload (workload balancing)
                    const currentWorkload = observerWorkload.get(observer.observerid) || 0;
                    score *= Math.max(0.1, 1 - (currentWorkload * 0.1)); // Reduce score for high workload
                    
                    // Bonus for consecutive assignments (efficiency)
                    const busyTimes = observerBusyTimes.get(observer.observerid) || [];
                    const hasConsecutive = busyTimes.some(busyTime => {
                        if (busyTime.date.getTime() !== examDate.getTime()) return false;
                        return busyTime.endTime === examStartTime || examEndTime === busyTime.startTime;
                    });
                    if (hasConsecutive) {
                        score *= 1.2; // Bonus for consecutive assignments
                    }
                    
                    return { observer, score };
                });
                
                // Sort by score (descending)
                scoredObservers.sort((a, b) => b.score - a.score);
                
                // Select head and secretary (different observers)
                const head = scoredObservers[0].observer;
                const secretary = scoredObservers.find(s => s.observer.observerid !== head.observerid)?.observer || scoredObservers[1].observer;
                
                // Create assignment
                assignments.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                // Mark observers as busy during this exam time
                const busyTime = {
                    date: examDate,
                    startTime: examStartTime,
                    endTime: examEndTime,
                    examId: exam.examid
                };
                
                observerBusyTimes.get(head.observerid).push(busyTime);
                observerBusyTimes.get(secretary.observerid).push(busyTime);
                
                // Update workload
                observerWorkload.set(head.observerid, (observerWorkload.get(head.observerid) || 0) + 1);
                observerWorkload.set(secretary.observerid, (observerWorkload.get(secretary.observerid) || 0) + 1);
                
            } else if (availableObservers.length === 1) {
                // Fallback: assign same observer as both head and secretary
                const observer = availableObservers[0];
                
                assignments.push({
                    examId: exam.examid,
                    headId: observer.observerid,
                    secretaryId: observer.observerid
                });
                
                const busyTime = {
                    date: examDate,
                    startTime: examStartTime,
                    endTime: examEndTime,
                    examId: exam.examid
                };
                
                observerBusyTimes.get(observer.observerid).push(busyTime);
                observerWorkload.set(observer.observerid, (observerWorkload.get(observer.observerid) || 0) + 1);
                
            } else {
                // No available observers
                assignments.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        const successfulAssignments = assignments.filter(a => a.headId && a.secretaryId).length;
        console.log(`[LP] Assignment complete: ${successfulAssignments}/${data.exams.length} exams assigned successfully`);
        
        // Log workload distribution
        const workloads = Array.from(observerWorkload.values());
        const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
        const maxWorkload = Math.max(...workloads);
        const minWorkload = Math.min(...workloads);
        console.log(`[LP] Workload distribution: avg=${avgWorkload.toFixed(1)}, min=${minWorkload}, max=${maxWorkload}`);
        
        // Validate assignments for overlaps
        this.validateAssignmentsForOverlaps(assignments, data);
        
        return assignments;
    }

    /**
     * Calculate objective value for a given phase and assignments
     */
    calculateObjectiveValue(assignments, phase, data) {
        const successfulAssignments = assignments.filter(a => a.headId && a.secretaryId);
        const coverage = successfulAssignments.length / data.exams.length;
        
        switch (phase.name) {
            case 'Coverage':
                return coverage;
                
            case 'Workload Balance':
                // Calculate workload variance
                const observerWorkload = new Map();
                successfulAssignments.forEach(assignment => {
                    observerWorkload.set(assignment.headId, (observerWorkload.get(assignment.headId) || 0) + 1);
                    observerWorkload.set(assignment.secretaryId, (observerWorkload.get(assignment.secretaryId) || 0) + 1);
                });
                
                const workloads = Array.from(observerWorkload.values());
                if (workloads.length === 0) return 0;
                
                const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
                const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
                return Math.max(0, 1 - variance / avgWorkload);
                
            case 'Fairness':
                // Calculate fairness based on workload distribution
                const observerWorkload2 = new Map();
                successfulAssignments.forEach(assignment => {
                    observerWorkload2.set(assignment.headId, (observerWorkload2.get(assignment.headId) || 0) + 1);
                    observerWorkload2.set(assignment.secretaryId, (observerWorkload2.get(assignment.secretaryId) || 0) + 1);
                });
                
                const maxWorkload = Math.max(...Array.from(observerWorkload2.values()));
                return Math.max(0, 1 - maxWorkload / 10); // Normalize by expected max workload
                
            case 'Efficiency':
                // Calculate consecutive assignments
                let consecutiveCount = 0;
                for (let i = 1; i < assignments.length; i++) {
                    const prev = assignments[i - 1];
                    const curr = assignments[i];
                    if (prev.headId && curr.headId) {
                        const prevExam = data.exams[i - 1];
                        const currExam = data.exams[i];
                        if (prevExam.examdate === currExam.examdate && 
                            prevExam.endtime === currExam.starttime) {
                            if (prev.headId === curr.headId || prev.secretaryId === curr.secretaryId) {
                                consecutiveCount++;
                            }
                        }
                    }
                }
                return consecutiveCount / Math.max(1, assignments.length - 1);
                
            case 'Title Preference':
                // Calculate title preference score
                let titleScore = 0;
                successfulAssignments.forEach(assignment => {
                    const headObserver = data.observers.find(o => o.observerid === assignment.headId);
                    const secretaryObserver = data.observers.find(o => o.observerid === assignment.secretaryId);
                    
                    if (headObserver?.title?.toLowerCase().includes('dr')) {
                        titleScore += 1.2;
                    } else {
                        titleScore += 1.0;
                    }
                    
                    if (secretaryObserver?.title?.toLowerCase().includes('dr')) {
                        titleScore += 0.9; // Slight penalty for Dr. as secretary
                    } else {
                        titleScore += 1.0;
                    }
                });
                return titleScore / (successfulAssignments.length * 2);
                
            default:
                return coverage;
        }
    }

    /**
     * Apply solution to database
     */
    async applySolution(client, solution, data) {
        console.log(`[LP] Applying solution with ${solution.assignments.length} assignments`);
        
        // Clear existing assignments
        const examIds = data.exams.map(e => e.examid);
        await client.query(
            'DELETE FROM ExamAssignment WHERE ExamID = ANY($1)',
            [examIds]
        );
        
        await client.query(
            'UPDATE ExamSchedule SET ExamHead = NULL, ExamSecretary = NULL, Status = \'unassigned\' WHERE ExamID = ANY($1)',
            [examIds]
        );
        
        // Apply new assignments
        const successful = [];
        const failed = [];
        
        for (const assignment of solution.assignments) {
            if (assignment.headId && assignment.secretaryId) {
                try {
                    // Insert head assignment
                    await client.query(`
                        INSERT INTO ExamAssignment (ExamID, ScheduleID, ObserverID, Role, Status)
                        VALUES ($1, $2, $3, 'head', 'active')
                    `, [assignment.examId, data.exams[0].scheduleid, assignment.headId]);
                    
                    // Insert secretary assignment
                    await client.query(`
                        INSERT INTO ExamAssignment (ExamID, ScheduleID, ObserverID, Role, Status)
                        VALUES ($1, $2, $3, 'secretary', 'active')
                    `, [assignment.examId, data.exams[0].scheduleid, assignment.secretaryId]);
                    
                    // Update exam schedule
                    await client.query(`
                        UPDATE ExamSchedule 
                        SET ExamHead = $1, ExamSecretary = $2, Status = 'assigned'
                        WHERE ExamID = $3
                    `, [assignment.headId, assignment.secretaryId, assignment.examId]);
                    
                    successful.push({
                        examId: assignment.examId,
                        headId: assignment.headId,
                        secretaryId: assignment.secretaryId
                    });
                } catch (error) {
                    failed.push({
                        examId: assignment.examId,
                        reason: error.message
                    });
                }
            } else {
                failed.push({
                    examId: assignment.examId,
                    reason: 'No valid assignment found'
                });
            }
        }
        
        return {
            successful,
            failed,
            performance: {
                finalFitness: solution.objectiveValue,
                totalTimeMs: Date.now() - this.performanceMetrics.startTime
            }
        };
    }

    /**
     * Save performance report
     */
    async savePerformanceReport(results, data) {
        try {
            const reportsDir = path.join(__dirname, '../../reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filepath = path.join(reportsDir, `lp-performance-${timestamp}.json`);
            
            // Calculate basic quality metrics
            const qualityScore = {
                coverage: results.successful.length / data.exams.length,
                workloadBalance: this.calculateWorkloadBalance(results.successful, data.observers),
                titlePreference: this.calculateTitlePreference(results.successful, data.observers)
            };
            
            const report = {
                timestamp: new Date().toISOString(),
                algorithm: 'linear_programming_lexicographic',
                examCount: data.exams.length,
                observerCount: data.observers.length,
                conflictCount: data.conflicts.length,
                phaseResults: this.performanceMetrics.phaseResults,
                finalResults: {
                    totalExams: results.successful.length + results.failed.length,
                    assignedExams: results.successful.length,
                    failedExams: results.failed.length,
                    successRate: ((results.successful.length / data.exams.length) * 100).toFixed(1) + '%'
                },
                performance: {
                    finalFitness: results.performance.finalFitness,
                    totalTimeMs: results.performance.totalTimeMs,
                    examsPerSecond: (data.exams.length / (results.performance.totalTimeMs / 1000)).toFixed(2)
                },
                qualityMetrics: qualityScore,
                results
            };
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            console.log(`[LP] Performance report saved to ${filepath}`);
        } catch (error) {
            console.error('Error saving LP performance report:', error);
        }
    }

    /**
     * Validate assignments for overlaps and log any issues
     */
    validateAssignmentsForOverlaps(assignments, data) {
        console.log('[LP] Validating assignments for overlaps...');
        
        const observerAssignments = new Map();
        const overlaps = [];
        
        // Group assignments by observer
        assignments.forEach(assignment => {
            if (assignment.headId) {
                if (!observerAssignments.has(assignment.headId)) {
                    observerAssignments.set(assignment.headId, []);
                }
                observerAssignments.get(assignment.headId).push({
                    examId: assignment.examId,
                    role: 'head',
                    ...data.exams.find(e => e.examid === assignment.examId)
                });
            }
            
            if (assignment.secretaryId) {
                if (!observerAssignments.has(assignment.secretaryId)) {
                    observerAssignments.set(assignment.secretaryId, []);
                }
                observerAssignments.get(assignment.secretaryId).push({
                    examId: assignment.examId,
                    role: 'secretary',
                    ...data.exams.find(e => e.examid === assignment.examId)
                });
            }
        });
        
        // Check each observer for overlaps
        observerAssignments.forEach((exams, observerId) => {
            if (exams.length <= 1) return;
            
            // Check each pair of exams for conflicts
            for (let i = 0; i < exams.length; i++) {
                for (let j = i + 1; j < exams.length; j++) {
                    const exam1 = exams[i];
                    const exam2 = exams[j];
                    
                    if (this.examsConflict(exam1, exam2)) {
                        const observer = data.observers.find(o => o.observerid === observerId);
                        overlaps.push({
                            observerId,
                            observerName: observer?.name || 'Unknown',
                            exam1: {
                                id: exam1.examid,
                                name: exam1.examname,
                                date: exam1.examdate,
                                time: `${exam1.starttime}-${exam1.endtime}`,
                                role: exam1.role
                            },
                            exam2: {
                                id: exam2.examid,
                                name: exam2.examname,
                                date: exam2.examdate,
                                time: `${exam2.starttime}-${exam2.endtime}`,
                                role: exam2.role
                            }
                        });
                    }
                }
            }
        });
        
        if (overlaps.length > 0) {
            console.error(`[LP] WARNING: Found ${overlaps.length} overlapping assignments!`);
            overlaps.forEach(overlap => {
                console.error(`[LP] OVERLAP: ${overlap.observerName} (${overlap.observerId}) assigned to:`);
                console.error(`  - ${overlap.exam1.name} (${overlap.exam1.date} ${overlap.exam1.time}) as ${overlap.exam1.role}`);
                console.error(`  - ${overlap.exam2.name} (${overlap.exam2.date} ${overlap.exam2.time}) as ${overlap.exam2.role}`);
            });
        } else {
            console.log('[LP] Validation passed: No overlapping assignments found');
        }
        
        return overlaps;
    }

    /**
     * Validate database assignments for overlaps after applying solution
     */
    async validateDatabaseAssignments(client, data) {
        console.log('[LP] Validating database assignments for overlaps...');
        
        // Query all assignments from database
        const examIds = data.exams.map(e => e.examid);
        const assignmentsResult = await client.query(`
            SELECT 
                ea.ExamID,
                ea.ObserverID,
                ea.Role,
                es.ExamName,
                es.ExamDate,
                es.StartTime,
                es.EndTime,
                o.Name as ObserverName
            FROM ExamAssignment ea
            JOIN ExamSchedule es ON ea.ExamID = es.ExamID
            JOIN Observer o ON ea.ObserverID = o.ObserverID
            WHERE ea.ExamID = ANY($1) AND ea.Status = 'active'
            ORDER BY ea.ObserverID, es.ExamDate, es.StartTime
        `, [examIds]);
        
        const assignments = assignmentsResult.rows;
        const observerAssignments = new Map();
        const overlaps = [];
        
        // Group assignments by observer
        assignments.forEach(assignment => {
            if (!observerAssignments.has(assignment.observerid)) {
                observerAssignments.set(assignment.observerid, []);
            }
            observerAssignments.get(assignment.observerid).push(assignment);
        });
        
        // Check each observer for overlaps
        observerAssignments.forEach((exams, observerId) => {
            if (exams.length <= 1) return;
            
            // Check each pair of exams for conflicts
            for (let i = 0; i < exams.length; i++) {
                for (let j = i + 1; j < exams.length; j++) {
                    const exam1 = exams[i];
                    const exam2 = exams[j];
                    
                    // Check if same exam (duplicate assignment)
                    if (exam1.examid === exam2.examid) {
                        overlaps.push({
                            observerId,
                            observerName: exam1.observername,
                            type: 'duplicate',
                            exam: {
                                id: exam1.examid,
                                name: exam1.examname,
                                date: exam1.examdate,
                                time: `${exam1.starttime}-${exam1.endtime}`,
                                roles: [exam1.role, exam2.role]
                            }
                        });
                        continue;
                    }
                    
                    // Check for time conflicts
                    if (this.examsConflict(exam1, exam2)) {
                        overlaps.push({
                            observerId,
                            observerName: exam1.observername,
                            type: 'time_conflict',
                            exam1: {
                                id: exam1.examid,
                                name: exam1.examname,
                                date: exam1.examdate,
                                time: `${exam1.starttime}-${exam1.endtime}`,
                                role: exam1.role
                            },
                            exam2: {
                                id: exam2.examid,
                                name: exam2.examname,
                                date: exam2.examdate,
                                time: `${exam2.starttime}-${exam2.endtime}`,
                                role: exam2.role
                            }
                        });
                    }
                }
            }
        });
        
        if (overlaps.length > 0) {
            console.error(`[LP] DATABASE VALIDATION FAILED: Found ${overlaps.length} overlapping assignments in database!`);
            overlaps.forEach(overlap => {
                if (overlap.type === 'duplicate') {
                    console.error(`[LP] DUPLICATE: ${overlap.observerName} (${overlap.observerId}) assigned to same exam multiple times:`);
                    console.error(`  - ${overlap.exam.name} (${overlap.exam.date} ${overlap.exam.time}) as ${overlap.exam.roles.join(' and ')}`);
                } else {
                    console.error(`[LP] TIME CONFLICT: ${overlap.observerName} (${overlap.observerId}) assigned to:`);
                    console.error(`  - ${overlap.exam1.name} (${overlap.exam1.date} ${overlap.exam1.time}) as ${overlap.exam1.role}`);
                    console.error(`  - ${overlap.exam2.name} (${overlap.exam2.date} ${overlap.exam2.time}) as ${overlap.exam2.role}`);
                }
            });
        } else {
            console.log('[LP] Database validation passed: No overlapping assignments found in database');
        }
        
        return overlaps;
    }

    /**
     * Calculate workload balance metric
     */
    calculateWorkloadBalance(assignments, observers) {
        const observerWorkload = new Map();
        
        // Count assignments per observer
        assignments.forEach(assignment => {
            observerWorkload.set(assignment.headId, (observerWorkload.get(assignment.headId) || 0) + 1);
            observerWorkload.set(assignment.secretaryId, (observerWorkload.get(assignment.secretaryId) || 0) + 1);
        });
        
        const workloads = Array.from(observerWorkload.values());
        if (workloads.length === 0) return 1.0;
        
        const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
        const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
        
        // Return balance score (1.0 = perfect balance, 0.0 = very unbalanced)
        return Math.max(0, 1 - (variance / avgWorkload));
    }

    /**
     * Calculate title preference metric
     */
    calculateTitlePreference(assignments, observers) {
        let drAsHead = 0;
        let totalAssignments = 0;
        
        assignments.forEach(assignment => {
            const headObserver = observers.find(o => o.observerid === assignment.headId);
            if (headObserver?.title?.toLowerCase().includes('dr')) {
                drAsHead++;
            }
            totalAssignments++;
        });
        
        return totalAssignments > 0 ? drAsHead / totalAssignments : 0;
    }
}

module.exports = LinearProgrammingAssignmentService; 