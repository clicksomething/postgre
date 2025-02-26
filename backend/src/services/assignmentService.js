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
            // This query finds all eligible observers
            const result = await client.query(`
                SELECT DISTINCT o.* 
                FROM Observer o
                WHERE 
                    -- Include full-time observers
                    (o.Availability = 'full-time'
                    OR 
                    -- For part-time observers, check their time slots
                    (o.Availability = 'part-time' AND EXISTS (
                        SELECT 1 FROM TimeSlot ts 
                        WHERE ts.ObserverID = o.ObserverID
                        AND ts.day = TRIM(TO_CHAR($1::date, 'Day'))
                        AND $2::time >= ts.StartTime 
                        AND $3::time <= ts.EndTime
                    )))
                    -- Exclude observers already assigned to overlapping exams
                    AND o.ObserverID NOT IN (
                        SELECT ea.ObserverID
                        FROM ExamAssignment ea
                        JOIN ExamSchedule es ON ea.ExamID = es.ExamID
                        WHERE es.ExamDate = $1
                        AND (
                            ($2 BETWEEN es.StartTime AND es.EndTime)
                            OR
                            ($3 BETWEEN es.StartTime AND es.EndTime)
                            OR
                            (es.StartTime BETWEEN $2 AND $3)
                        )
                    )
                ORDER BY 
                    o.Availability DESC, -- full-time first
                    o.Name ASC
            `, [exam.ExamDate, exam.StartTime, exam.EndTime]);

            return result.rows;
        } catch (error) {
            console.error('Error getting available observers:', error);
            throw error;
        }
    },

    // Assign observers to an exam
    assignObserversToExam: async (examId) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Start transaction

            // 1. Check if exam exists and isn't already fully assigned
            const examResult = await client.query(`
                SELECT * FROM ExamSchedule 
                WHERE ExamID = $1 
                AND Status != 'assigned'`, // Prevent reassignment
                [examId]
            );
            const exam = examResult.rows[0];

            if (!exam) {
                throw new Error(
                    examResult.rows.length === 0 
                        ? 'Exam not found' 
                        : 'Exam is already fully assigned'
                );
            }

            // 2. Check if exam date is in the past
            if (new Date(exam.ExamDate) < new Date()) {
                throw new Error('Cannot assign observers to past exams');
            }

            // 3. Get available observers with error handling
            const availableObservers = await AssignmentService.getAvailableObservers(exam);
            
            if (availableObservers.length < 2) {
                throw new Error(`Not enough available observers. Found: ${availableObservers.length}, Need: 2`);
            }

            // 4. Check existing partial assignments
            const existingAssignments = await client.query(`
                SELECT ObserverID, Role 
                FROM ExamAssignment 
                WHERE ExamID = $1 
                AND Status = 'active'`,
                [examId]
            );

            let headObserver = null;
            let secretaryObserver = null;
            const existingHead = existingAssignments.rows.find(a => a.Role === 'head');
            const existingSecretary = existingAssignments.rows.find(a => a.Role === 'secretary');

            // 5. Get current workload with error handling
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

            // 6. Sort observers by workload and availability type
            const sortedObservers = availableObservers.sort((a, b) => {
                // Prioritize full-time over part-time
                if (a.Availability !== b.Availability) {
                    return a.Availability === 'full-time' ? -1 : 1;
                }
                // Then by workload
                const workloadA = workloadMap.get(a.ObserverID);
                const workloadB = workloadMap.get(b.ObserverID);
                if (workloadA !== workloadB) {
                    return workloadA - workloadB;
                }
                // Finally by name for consistency
                return a.Name.localeCompare(b.Name);
            });

            // 7. Assign observers considering existing assignments
            if (!existingHead) {
                headObserver = sortedObservers[0];
            }
            if (!existingSecretary) {
                secretaryObserver = sortedObservers.find(o => 
                    o.ObserverID !== (headObserver?.ObserverID || existingHead?.ObserverID)
                );
            }

            // 8. Validate final assignments
            if (!headObserver && !existingHead) {
                throw new Error('Could not assign head observer');
            }
            if (!secretaryObserver && !existingSecretary) {
                throw new Error('Could not assign secretary');
            }

            // 9. Create new assignments
            if (headObserver) {
                await client.query(`
                    INSERT INTO ExamAssignment 
                    (ExamID, ObserverID, Role, Status) 
                    VALUES ($1, $2, 'head', 'active')`,
                    [examId, headObserver.ObserverID]
                );
            }
            if (secretaryObserver) {
                await client.query(`
                    INSERT INTO ExamAssignment 
                    (ExamID, ObserverID, Role, Status) 
                    VALUES ($1, $2, 'secretary', 'active')`,
                    [examId, secretaryObserver.ObserverID]
                );
            }

            await client.query('COMMIT');

            return {
                success: true,
                head: headObserver || existingHead,
                secretary: secretaryObserver || existingSecretary,
                message: 'Assignment completed successfully'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error in assignObserversToExam:', error);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = AssignmentService; 