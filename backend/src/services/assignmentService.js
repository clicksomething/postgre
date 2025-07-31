const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');
const { 
  parseTimeToMinutes, 
  getDayName, 
  examFitsInTimeslot,
  examsOverlap 
} = require('../utils/dateTimeUtils');

const AssignmentService = {
    // Get exam details
    getExamDetails: async (examId) => {
        const result = await client.query(
            'SELECT * FROM ExamSchedule WHERE ExamID = $1',
            [examId]
        );
        return result.rows[0];
    },

    // Get observer workload
    getObserverWorkload: async (observerId, examDate) => {
        const result = await client.query(`
            SELECT COUNT(*) as workload 
            FROM ExamAssignment 
            WHERE ObserverID = $1 
            AND ExamDate = $2`,
            [observerId, examDate]
        );
        return parseInt(result.rows[0].workload);
    },

    // Get available observers for an exam
    getAvailableObservers: async (exam) => {
        try {
            // Get exam details
            const examDate = new Date(exam.ExamDate);
            const examDay = examDate.toLocaleString('en-US', { weekday: 'long' });
            const examStartTime = exam.StartTime;
            const examEndTime = exam.EndTime;

            // Query to get available observers with conflict checking
            const query = `
                WITH exam_conflicts AS (
                    SELECT 
                        ea.ObserverID,
                        COUNT(*) as conflict_count
                    FROM ExamAssignment ea
                    JOIN ExamSchedule es ON ea.ExamID = es.ExamID
                    WHERE ea.Status = 'active'
                    AND es.ExamDate = $1
                    AND (
                        (es.StartTime < $3 AND es.EndTime > $2) OR
                        (es.StartTime >= $2 AND es.StartTime < $3)
                    )
                    GROUP BY ea.ObserverID
                )
                SELECT 
                    o.*,
                    COALESCE(ec.conflict_count, 0) as conflict_count
                FROM Observer o
                LEFT JOIN exam_conflicts ec ON o.ObserverID = ec.ObserverID
                WHERE ec.conflict_count IS NULL OR ec.conflict_count = 0
                ORDER BY o.Title DESC NULLS LAST, o.Name
            `;

            const result = await client.query(query, [
                exam.ExamDate,
                examStartTime,
                examEndTime
            ]);

            // Filter by availability and time slots
            const filteredObservers = result.rows.filter(observer => {
                if (observer.Availability === 'full-time') {
                    return true;
                }
                
                // For part-time, need to check time slots
                return true; // Simplified for now
            });

            // Get time slots for part-time observers
            if (filteredObservers.some(o => o.Availability === 'part-time')) {
                const partTimeIds = filteredObservers
                    .filter(o => o.Availability === 'part-time')
                    .map(o => o.ObserverID);

                const timeSlotQuery = `
                SELECT 
                    o.ObserverID, 
                    o.Name, 
                    o.Availability,
                    ts.day, 
                    ts.StartTime, 
                    ts.EndTime,
                        COALESCE(ec.conflict_count, 0) as conflict_count
                FROM Observer o
                    LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
                    LEFT JOIN (
                        SELECT 
                            ea.ObserverID,
                            COUNT(*) as conflict_count
                        FROM ExamAssignment ea
                        JOIN ExamSchedule es ON ea.ExamID = es.ExamID
                        WHERE ea.Status = 'active'
                        AND es.ExamDate = $1
                        AND (
                            (es.StartTime < $3 AND es.EndTime > $2) OR
                            (es.StartTime >= $2 AND es.StartTime < $3)
                        )
                        GROUP BY ea.ObserverID
                    ) ec ON o.ObserverID = ec.ObserverID
                WHERE o.ObserverID = ANY($4)
                    AND ts.day = $5
                    AND ts.StartTime <= $2
                    AND ts.EndTime >= $3
                    AND (ec.conflict_count IS NULL OR ec.conflict_count = 0)
                `;

                const timeSlotResult = await client.query(timeSlotQuery, [
                    exam.ExamDate,
                    examStartTime,
                    examEndTime,
                    partTimeIds,
                    examDay
                ]);
            }

            return result.rows;
        } catch (error) {
            console.error('Error getting available observers:', error);
            throw error;
        }
    },

    // Bulk assign observers to multiple exams - ULTRA FAST VERSION
    assignObserversToExam: async (examId) => {
        // Performance tracking
        const performanceMetrics = {
            startTime: Date.now(),
            phases: {},
            examCount: 0,
            observerCount: 0,
            assignmentCount: 0,
            failedCount: 0,
            databaseQueries: 0,
            memoryUsage: process.memoryUsage()
        };

        const trackPhase = (phaseName) => {
            if (!performanceMetrics.phases[phaseName]) {
                performanceMetrics.phases[phaseName] = {
                    startTime: Date.now(),
                    endTime: null,
                    duration: null
                };
            } else {
                performanceMetrics.phases[phaseName].endTime = Date.now();
                performanceMetrics.phases[phaseName].duration = 
                    performanceMetrics.phases[phaseName].endTime - 
                    performanceMetrics.phases[phaseName].startTime;
            }
        };

        try {
            trackPhase('initialization');

            // Start transaction
            await client.query('BEGIN');
            performanceMetrics.databaseQueries++;

            // Get all unassigned exams if examId is an array, otherwise just the single exam
            const examIds = Array.isArray(examId) ? examId : [examId];
            trackPhase('initialization');
            
            // 1. Clear existing assignments for all exams in one query
            trackPhase('clearAssignments');
            await client.query(`
                DELETE FROM ExamAssignment 
                WHERE ExamID = ANY($1)`,
                [examIds]
            );
            performanceMetrics.databaseQueries++;

            await client.query(`
                UPDATE ExamSchedule 
                SET ExamHead = NULL, ExamSecretary = NULL, Status = 'unassigned'
                WHERE ExamID = ANY($1)`,
                [examIds]
            );
            performanceMetrics.databaseQueries++;
            trackPhase('clearAssignments');

            // 2. Get all exam details in one query
            trackPhase('fetchExams');
            const examsResult = await client.query(`
                SELECT 
                    es.*,
                    c.CourseName,
                    r.RoomNum
                FROM ExamSchedule es
                JOIN Course c ON es.CourseID = c.CourseID
                JOIN Room r ON es.RoomID = r.RoomID
                WHERE es.ExamID = ANY($1)
                ORDER BY es.ExamDate, es.StartTime
            `, [examIds]);
            performanceMetrics.databaseQueries++;

            const exams = examsResult.rows;
            performanceMetrics.examCount = exams.length;
            trackPhase('fetchExams');

            // 3. Get ALL observers with their availability and current workload in ONE query
            trackPhase('fetchObservers');
            const observersResult = await client.query(`
                WITH observer_workload AS (
                    SELECT 
                        ObserverID,
                        COUNT(*) as assignment_count
                FROM ExamAssignment 
                    WHERE Status = 'active'
                    GROUP BY ObserverID
                ),
                observer_time_slots AS (
                    SELECT 
                        ObserverID,
                        array_agg(
                            json_build_object(
                                'day', day,
                                'startTime', StartTime,
                                'endTime', EndTime
                            )
                        ) as time_slots
                    FROM TimeSlot
                    GROUP BY ObserverID
                )
                SELECT 
                    o.*,
                    COALESCE(ow.assignment_count, 0) as current_workload,
                    ots.time_slots
                FROM Observer o
                LEFT JOIN observer_workload ow ON o.ObserverID = ow.ObserverID
                LEFT JOIN observer_time_slots ots ON o.ObserverID = ots.ObserverID
                ORDER BY 
                    CASE WHEN o.Title ILIKE '%dr%' THEN 0 ELSE 1 END,
                    COALESCE(ow.assignment_count, 0),
                    o.ObserverID
            `);
            performanceMetrics.databaseQueries++;

            const allObservers = observersResult.rows;
            performanceMetrics.observerCount = allObservers.length;
            trackPhase('fetchObservers');

            // 4. Get ALL existing conflicts for ALL observers on ALL exam dates in ONE query
            trackPhase('fetchConflicts');
            const examDates = [...new Set(exams.map(e => e.examdate))];
            // Get the schedule ID from the first exam
            const scheduleResult = await client.query(
                'SELECT ScheduleID FROM ExamSchedule WHERE ExamID = $1',
                [examIds[0]]
            );
            const scheduleId = scheduleResult.rows[0]?.scheduleid;
            
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
            performanceMetrics.databaseQueries++;

            // Build conflict map
            const conflictMap = new Map();
            conflictsResult.rows.forEach(conflict => {
                const key = `${conflict.observerid}_${conflict.examdate}`;
                if (!conflictMap.has(key)) {
                    conflictMap.set(key, []);
                }
                conflictMap.get(key).push({
                    startTime: conflict.starttime,
                    endTime: conflict.endtime,
                    examId: conflict.examid
                });
            });
            trackPhase('fetchConflicts');

            // 5. Process all exams and build assignment arrays
            trackPhase('processAssignments');
            const assignmentInserts = [];
            const examUpdates = [];
            const results = {
                successful: [],
                failed: []
            };

            // Track observer usage to distribute workload
            const observerUsage = new Map();
            allObservers.forEach(o => {
                observerUsage.set(o.observerid, o.current_workload || 0);
            });

            for (const exam of exams) {
                const examDate = new Date(exam.examdate);
                const examDay = examDate.toLocaleString('en-US', { weekday: 'long' });

                // Filter available observers for this exam
                const availableObservers = allObservers.filter(observer => {
                    // For full-time observers, only check conflicts
                    if (observer.availability === 'full-time' || !observer.availability) {
                        // Check conflicts
                        const conflictKey = `${observer.observerid}_${exam.examdate}`;
                        const conflicts = conflictMap.get(conflictKey) || [];
                        const hasConflict = conflicts.some(conflict => {
                            // Handle both camelCase and lowercase property names
                            const conflictStart = conflict.startTime || conflict.starttime;
                            const conflictEnd = conflict.endTime || conflict.endtime;
                            return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
                        });
                        return !hasConflict;
                    }
                    
                    // For part-time observers, check time slots
                    if (observer.availability === 'part-time') {
                        // If no time slots defined, assume not available
                        if (!observer.time_slots || observer.time_slots.length === 0) {
                            return false;
                        }
                        
                        // Check if observer has a matching time slot
                        const hasMatchingSlot = observer.time_slots.some(slot => {
                            if (!slot) return false;
                            
                            // Check if the day matches
                            const slotDay = slot.day ? slot.day.toLowerCase() : '';
                            const examDayLower = examDay.toLowerCase();
                            
                            if (slotDay !== examDayLower) return false;
                            
                            // Check if exam time is within slot time
                            // Handle both camelCase and lowercase property names
                            const slotStart = slot.startTime || slot.starttime;
                            const slotEnd = slot.endTime || slot.endtime;
                            
                            if (!slotStart || !slotEnd) return false;
                            
                            // Use bulletproof time comparison
                            const slotStartMinutes = parseTimeToMinutes(slotStart);
                            const slotEndMinutes = parseTimeToMinutes(slotEnd);
                            const examStartMinutes = parseTimeToMinutes(exam.starttime);
                            const examEndMinutes = parseTimeToMinutes(exam.endtime);
                            
                            return slotStartMinutes <= examStartMinutes && slotEndMinutes >= examEndMinutes;
                        });
                        
                        if (!hasMatchingSlot) return false;
                        
                        // Also check conflicts for part-time observers
                        const conflictKey = `${observer.observerid}_${exam.examdate}`;
                        const conflicts = conflictMap.get(conflictKey) || [];
                        const hasConflict = conflicts.some(conflict => {
                            // Handle both camelCase and lowercase property names
                            const conflictStart = conflict.startTime || conflict.starttime;
                            const conflictEnd = conflict.endTime || conflict.endtime;
                            
                            // Use bulletproof time comparison
                            const conflictStartMinutes = parseTimeToMinutes(conflictStart);
                            const conflictEndMinutes = parseTimeToMinutes(conflictEnd);
                            const examStartMinutes = parseTimeToMinutes(exam.starttime);
                            const examEndMinutes = parseTimeToMinutes(exam.endtime);
                            
                            return (examStartMinutes < conflictEndMinutes && examEndMinutes > conflictStartMinutes);
                        });
                        
                        return !hasConflict;
                    }
                    
                    // Default: not available
                    return false;
                });



                if (availableObservers.length < 2) {
                    results.failed.push({
                        examId: exam.examid,
                        examName: exam.examname,
                        reason: `Only ${availableObservers.length} observers available`
                    });
                    performanceMetrics.failedCount++;
                    continue;
                }

                // Sort by current usage (including new assignments)
                availableObservers.sort((a, b) => {
                    const isDrA = a.title && a.title.toLowerCase().includes('dr');
                    const isDrB = b.title && b.title.toLowerCase().includes('dr');
                    if (isDrA !== isDrB) return isDrA ? -1 : 1;

                    const usageA = observerUsage.get(a.observerid) || 0;
                    const usageB = observerUsage.get(b.observerid) || 0;
                    return usageA - usageB;
                });

                // Assign observers
                const headObserver = availableObservers[0];
                const secretaryObserver = availableObservers.find(o => o.observerid !== headObserver.observerid);

                if (!headObserver || !secretaryObserver) {
                    results.failed.push({
                        examId: exam.examid,
                        examName: exam.examname,
                        reason: 'Could not find suitable observers'
                    });
                    performanceMetrics.failedCount++;
                    continue;
                }

                // Add to batch arrays
                assignmentInserts.push(
                    [exam.examid, exam.scheduleid, headObserver.observerid, 'head', 'active'],
                    [exam.examid, exam.scheduleid, secretaryObserver.observerid, 'secretary', 'active']
                );

                examUpdates.push({
                    examId: exam.examid,
                    headId: headObserver.observerid,
                    secretaryId: secretaryObserver.observerid
                });

                // Update usage tracking
                observerUsage.set(headObserver.observerid, (observerUsage.get(headObserver.observerid) || 0) + 1);
                observerUsage.set(secretaryObserver.observerid, (observerUsage.get(secretaryObserver.observerid) || 0) + 1);

                // Update conflict map for next iterations
                const conflictKey1 = `${headObserver.observerid}_${exam.examdate}`;
                const conflictKey2 = `${secretaryObserver.observerid}_${exam.examdate}`;
                
                if (!conflictMap.has(conflictKey1)) conflictMap.set(conflictKey1, []);
                if (!conflictMap.has(conflictKey2)) conflictMap.set(conflictKey2, []);
                
                const newConflict = {
                    startTime: exam.starttime,
                    endTime: exam.endtime,
                    examId: exam.examid
                };
                
                conflictMap.get(conflictKey1).push(newConflict);
                conflictMap.get(conflictKey2).push(newConflict);

                results.successful.push({
                    examId: exam.examid,
                    examName: exam.examname,
                    head: headObserver.name,
                    secretary: secretaryObserver.name
                });
                performanceMetrics.assignmentCount++;
            }
            trackPhase('processAssignments');

            // 6. Execute ALL inserts in ONE query
            trackPhase('insertAssignments');
            if (assignmentInserts.length > 0) {
                const insertQuery = `
                    INSERT INTO ExamAssignment (ExamID, ScheduleID, ObserverID, Role, Status)
                    VALUES ${assignmentInserts.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
                `;
                await client.query(insertQuery, assignmentInserts.flat());
                performanceMetrics.databaseQueries++;
            }
            trackPhase('insertAssignments');

            // 7. Update ALL exam schedules in ONE query using CASE statements
            trackPhase('updateExams');
            if (examUpdates.length > 0) {
                const updateQuery = `
                    UPDATE ExamSchedule
                    SET 
                        Status = 'assigned',
                        ExamHead = CASE ExamID
                            ${examUpdates.map(u => `WHEN ${u.examId} THEN ${u.headId}`).join(' ')}
                        END,
                        ExamSecretary = CASE ExamID
                            ${examUpdates.map(u => `WHEN ${u.examId} THEN ${u.secretaryId}`).join(' ')}
                        END
                    WHERE ExamID IN (${examUpdates.map(u => u.examId).join(', ')})
                `;
                await client.query(updateQuery);
                performanceMetrics.databaseQueries++;
            }
            trackPhase('updateExams');

            trackPhase('commit');
            await client.query('COMMIT');
            performanceMetrics.databaseQueries++;
            trackPhase('commit');

            // Calculate final metrics
            performanceMetrics.endTime = Date.now();
            performanceMetrics.totalDuration = performanceMetrics.endTime - performanceMetrics.startTime;
            performanceMetrics.finalMemoryUsage = process.memoryUsage();
            performanceMetrics.memoryDelta = {
                heapUsed: performanceMetrics.finalMemoryUsage.heapUsed - performanceMetrics.memoryUsage.heapUsed,
                external: performanceMetrics.finalMemoryUsage.external - performanceMetrics.memoryUsage.external
            };

            // Calculate performance stats
            const performanceStats = {
                totalTimeMs: performanceMetrics.totalDuration,
                totalTimeSec: (performanceMetrics.totalDuration / 1000).toFixed(2),
                examsPerSecond: (performanceMetrics.examCount / (performanceMetrics.totalDuration / 1000)).toFixed(2),
                avgTimePerExamMs: (performanceMetrics.totalDuration / performanceMetrics.examCount).toFixed(2),
                databaseQueries: performanceMetrics.databaseQueries,
                memoryUsedMB: (performanceMetrics.memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
                phases: Object.entries(performanceMetrics.phases).map(([name, data]) => ({
                    phase: name,
                    durationMs: data.duration,
                    percentage: ((data.duration / performanceMetrics.totalDuration) * 100).toFixed(1)
                }))
            };

            // Save performance report to file
            const savePerformanceReport = async () => {
                try {
                    const MetricsService = require('./metricsService');
                    
                    // Prepare assignments for metrics service
                    const assignments = exams.map(exam => {
                        const successfulAssignment = results.successful.find(s => s.examId === exam.examid);
                        if (successfulAssignment) {
                            // Find the actual observer IDs
                            const headObserver = allObservers.find(o => o.name === successfulAssignment.head);
                            const secretaryObserver = allObservers.find(o => o.name === successfulAssignment.secretary);
                            return {
                                examId: exam.examid,
                                headId: headObserver?.observerid || null,
                                secretaryId: secretaryObserver?.observerid || null
                            };
                        } else {
                            return {
                                examId: exam.examid,
                                headId: null,
                                secretaryId: null
                            };
                        }
                    });
                    
                    // Format data for metrics service
                    const data = {
                        exams,
                        observers: allObservers
                    };
                    
                    // Format results for metrics service
                    const metricsResults = {
                        successful: assignments.filter(a => a.headId && a.secretaryId),
                        failed: assignments.filter(a => !a.headId || !a.secretaryId)
                    };
                    
                    // Save metrics using central service
                    await MetricsService.saveMetrics('random', metricsResults, data, {
                        executionTime: performanceMetrics.totalDuration,
                        operationType: Array.isArray(examId) ? 'bulk' : 'single',
                        databaseQueries: performanceMetrics.databaseQueries,
                        memoryUsedMB: (performanceMetrics.memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
                        phases: performanceMetrics.phases
                    });
                    
                    console.log('[PERFORMANCE] Random algorithm metrics saved successfully');
                } catch (error) {
                    console.error('[PERFORMANCE] Failed to save performance report:', error);
                }
            };

            // Save report asynchronously
            console.log('[PERFORMANCE] Calling savePerformanceReport...');
            savePerformanceReport();

            // Return appropriate response based on input
            if (Array.isArray(examId)) {
                return {
                    success: true,
                    results: results,
                    message: `Assigned ${results.successful.length} exams, ${results.failed.length} failed`,
                    performance: performanceStats
                };
            } else {
                // Single exam assignment
                if (results.successful.length > 0) {
                    const result = results.successful[0];
                    return {
                        success: true,
                        examId: result.examId,
                        head: { name: result.head },
                        secretary: { name: result.secretary },
                        message: 'Assignment completed successfully',
                        performance: performanceStats
                    };
                } else {
                    throw new Error(results.failed[0]?.reason || 'Assignment failed');
                }
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[ASSIGNMENT SERVICE] Error in assignObserversToExam:', error);
            throw error;
        }
    },

    // Handle observer unavailability
    handleObserverUnavailability: async (examId, observerId, reason) => {
        try {
            // Implementation here
        } catch (error) {
            console.error('Error handling observer unavailability:', error);
            throw error;
        }
    }
};

module.exports = AssignmentService; 