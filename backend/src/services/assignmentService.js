const { client } = require('../../database/db');

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
            // Log input exam details for debugging
            console.log('EXAM DETAILS FOR OBSERVER SELECTION:', {
                examId: exam.ExamID,
                examDate: exam.ExamDate,
                startTime: exam.StartTime,
                endTime: exam.EndTime,
                examDateObject: new Date(exam.ExamDate),
                examDay: new Date(exam.ExamDate).toLocaleString('en-US', { weekday: 'long' })
            });

            // This query finds all eligible observers with strict time conflict checking
            const result = await client.query(`
                WITH ExamConflicts AS (
                    SELECT DISTINCT ObserverID
                    FROM ExamAssignment ea
                    JOIN ExamSchedule es ON ea.ExamID = es.ExamID
                    WHERE es.ExamDate = $1
                    AND (
                        -- Exact time overlap
                        ($2 < es.EndTime AND $3 > es.StartTime)
                        OR 
                        (es.StartTime < $3 AND es.EndTime > $2)
                        -- Include exams within the same time range
                        OR 
                        ($2 >= es.StartTime AND $3 <= es.EndTime)
                        OR
                        (es.StartTime >= $2 AND es.EndTime <= $3)
                    )
                )
                SELECT DISTINCT o.* 
                FROM Observer o
                WHERE 
                    -- Full-time observers with no time conflicts
                    (o.Availability = 'full-time' 
                    AND o.ObserverID NOT IN (SELECT ObserverID FROM ExamConflicts))
                    OR 
                    -- Part-time observers with matching time slots and no conflicts
                    (o.Availability = 'part-time' 
                    AND o.ObserverID NOT IN (SELECT ObserverID FROM ExamConflicts)
                    AND EXISTS (
                        SELECT 1 FROM TimeSlot ts 
                        WHERE ts.ObserverID = o.ObserverID
                        AND (
                            ($2 BETWEEN ts.StartTime AND ts.EndTime)
                            OR 
                            ($3 BETWEEN ts.StartTime AND ts.EndTime)
                            OR
                            (ts.StartTime BETWEEN $2 AND $3)
                        )
                    ))
                ORDER BY 
                    o.Availability DESC, -- full-time first
                    o.Name ASC
            `, [exam.ExamDate, exam.StartTime, exam.EndTime]);

            // Log the result of the query
            console.log('AVAILABLE OBSERVERS:', {
                totalObservers: result.rows.length,
                observers: result.rows.map(o => ({
                    id: o.ObserverID,
                    name: o.Name,
                    availability: o.Availability
                }))
            });

            // Additional logging to check time slots and conflicts
            const timeSlotQuery = await client.query(`
                WITH ExamConflicts AS (
                    SELECT ObserverID
                    FROM ExamAssignment ea
                    JOIN ExamSchedule es ON ea.ExamID = es.ExamID
                    WHERE es.ExamDate = $1
                    AND (
                        ($2 < es.EndTime AND $3 > es.StartTime)
                        OR 
                        (es.StartTime < $3 AND es.EndTime > $2)
                        OR 
                        ($2 >= es.StartTime AND $3 <= es.EndTime)
                        OR
                        (es.StartTime >= $2 AND es.EndTime <= $3)
                    )
                )
                SELECT 
                    o.ObserverID, 
                    o.Name, 
                    o.Availability,
                    ts.day, 
                    ts.StartTime, 
                    ts.EndTime,
                    (SELECT COUNT(*) FROM ExamConflicts WHERE ObserverID = o.ObserverID) as conflict_count
                FROM Observer o
                LEFT JOIN TimeSlot ts ON ts.ObserverID = o.ObserverID
                WHERE o.ObserverID = ANY($4)
            `, [exam.ExamDate, exam.StartTime, exam.EndTime, result.rows.map(o => o.ObserverID)]);

            console.log('OBSERVER TIME SLOTS AND CONFLICTS:', {
                totalTimeSlots: timeSlotQuery.rows.length,
                timeSlots: timeSlotQuery.rows.map(ts => ({
                    observerId: ts.observerid,
                    name: ts.name,
                    availability: ts.availability,
                    day: ts.day,
                    startTime: ts.starttime,
                    endTime: ts.endtime,
                    conflictCount: ts.conflict_count
                }))
            });

            return result.rows;
        } catch (error) {
            console.error('Error getting available observers:', error);
            throw error;
        }
    },

    // Assign observers to an exam
    assignObserversToExam: async (examId) => {
        try {
            console.log(`[ASSIGNMENT SERVICE] Starting assignment for Exam ID: ${examId}`);

            // Start transaction
            await client.query('BEGIN');

            // 1. Get exam details with full information
            const examResult = await client.query(`
                SELECT 
                    es.*,
                    c.CourseName,
                    r.RoomNum
                FROM ExamSchedule es
                JOIN Course c ON es.CourseID = c.CourseID
                JOIN Room r ON es.RoomID = r.RoomID
                WHERE es.ExamID = $1
            `, [examId]);
            const exam = examResult.rows[0];

            console.log(`[ASSIGNMENT SERVICE] Exam Details:`, exam ? JSON.stringify(exam) : 'No exam found');

            if (!exam) {
                throw new Error('Exam not found');
            }

            // 2. Check if exam is already assigned
            const existingAssignments = await client.query(`
                SELECT ObserverID, Role 
                FROM ExamAssignment 
                WHERE ExamID = $1 
                AND Status = 'active'`,
                [examId]
            );

            console.log(`[ASSIGNMENT SERVICE] Existing Assignments:`, JSON.stringify(existingAssignments.rows));

            // If exam is already fully assigned, skip
            if (existingAssignments.rows.length >= 2) {
                await client.query('ROLLBACK');
                console.log(`[ASSIGNMENT SERVICE] Exam ${examId} is already fully assigned. Skipping.`);
                return {
                    success: false,
                    message: 'Exam is already fully assigned'
                };
            }

            // 3. Get available observers with strict conflict checking
            const availableObservers = await AssignmentService.getAvailableObservers(exam);
            
            console.log(`[ASSIGNMENT SERVICE] Available Observers:`, JSON.stringify(availableObservers));

            if (availableObservers.length < 2) {
                await client.query('ROLLBACK');
                throw new Error(`Not enough available observers. Found: ${availableObservers.length}, Need: 2`);
            }

            // 4. Get current workload
            const workloadQuery = `
                SELECT ObserverID, COUNT(*) as assignment_count
                FROM ExamAssignment
                WHERE ObserverID = ANY($1)
                AND Status = 'active'
                GROUP BY ObserverID
            `;
            const workloadResult = await client.query(workloadQuery, 
                [availableObservers.map(o => o.ObserverID)]
            );

            // Create workload map with default 0
            const workloadMap = new Map(
                availableObservers.map(o => [o.ObserverID, 0])
            );
            workloadResult.rows.forEach(row => {
                workloadMap.set(row.ObserverID, parseInt(row.assignment_count));
            });

            // 5. Sort observers with strict prioritization
            const sortedObservers = availableObservers.sort((a, b) => {
                // First, prioritize Dr. observers for head role
                const isDrA = a.Title && a.Title.toLowerCase().includes('dr');
                const isDrB = b.Title && b.Title.toLowerCase().includes('dr');
                if (isDrA !== isDrB) {
                    return isDrA ? -1 : 1;
                }

                // Prioritize full-time observers with least assignments
                const workloadA = workloadMap.get(a.ObserverID);
                const workloadB = workloadMap.get(b.ObserverID);
                
                // Full-time observers get priority, especially those with fewer assignments
                if (a.Availability === 'full-time' && b.Availability === 'full-time') {
                    return workloadA - workloadB;
                }
                
                // Full-time observers always come first
                if (a.Availability !== b.Availability) {
                    return a.Availability === 'full-time' ? -1 : 1;
                }
                
                // For part-time, consider workload
                if (workloadA !== workloadB) {
                    return workloadA - workloadB;
                }
                
                // Finally by name for consistency
                return a.Name.localeCompare(b.Name);
            });

            console.log(`[ASSIGNMENT SERVICE] Sorted Observers:`, JSON.stringify(sortedObservers));

            // 6. Assign observers
            let headObserver = null;
            let secretaryObserver = null;
            const existingHead = existingAssignments.rows.find(a => a.Role === 'head');
            const existingSecretary = existingAssignments.rows.find(a => a.Role === 'secretary');

            if (!existingHead) {
                // First, try to find a Dr. for head observer
                headObserver = sortedObservers.find(o => 
                    o.Title && o.Title.toLowerCase().includes('dr')
                ) || sortedObservers[0];
                console.log(`[ASSIGNMENT SERVICE] Selected Head Observer:`, JSON.stringify(headObserver));
            }
            if (!existingSecretary) {
                // Select a different observer for secretary
                secretaryObserver = sortedObservers.find(o => 
                    o.ObserverID !== (headObserver?.ObserverID || existingHead?.ObserverID)
                );
                console.log(`[ASSIGNMENT SERVICE] Selected Secretary Observer:`, JSON.stringify(secretaryObserver));
            }

            // 7. Validate final assignments
            if (!headObserver && !existingHead) {
                await client.query('ROLLBACK');
                throw new Error('Could not assign head observer');
            }
            if (!secretaryObserver && !existingSecretary) {
                await client.query('ROLLBACK');
                throw new Error('Could not assign secretary');
            }

            // 8. Create new assignments
            if (headObserver) {
                console.log(`[ASSIGNMENT SERVICE] Inserting Head Observer Assignment:`, {
                    examId,
                    observerId: headObserver.ObserverID
                });
                await client.query(`
                    INSERT INTO ExamAssignment 
                    (ExamID, ScheduleID, ObserverID, Role, Status) 
                    VALUES ($1, $2, $3, 'head', 'active')`,
                    [examId, exam.ScheduleID, headObserver.ObserverID]
                );
            }
            if (secretaryObserver) {
                console.log(`[ASSIGNMENT SERVICE] Inserting Secretary Observer Assignment:`, {
                    examId,
                    observerId: secretaryObserver.ObserverID
                });
                await client.query(`
                    INSERT INTO ExamAssignment 
                    (ExamID, ScheduleID, ObserverID, Role, Status) 
                    VALUES ($1, $2, $3, 'secretary', 'active')`,
                    [examId, exam.ScheduleID, secretaryObserver.ObserverID]
                );
            }

            // 9. Update exam status
            console.log(`[ASSIGNMENT SERVICE] Updating Exam Schedule:`, {
                examId,
                headObserverId: headObserver?.ObserverID || existingHead?.ObserverID,
                secretaryObserverId: secretaryObserver?.ObserverID || existingSecretary?.ObserverID
            });
            await client.query(`
                UPDATE ExamSchedule 
                SET Status = 'assigned', 
                    ExamHead = $2, 
                    ExamSecretary = $3 
                WHERE ExamID = $1`,
                [
                    examId, 
                    headObserver?.ObserverID || existingHead?.ObserverID, 
                    secretaryObserver?.ObserverID || existingSecretary?.ObserverID
                ]
            );

            // 10. Commit transaction
            await client.query('COMMIT');

            return {
                success: true,
                examId,
                head: headObserver || existingHead,
                secretary: secretaryObserver || existingSecretary,
                message: 'Assignment completed successfully'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[ASSIGNMENT SERVICE] Error in assignObserversToExam:', error);
            throw error;
        }
    },
};

module.exports = AssignmentService; 