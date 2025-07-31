const { client } = require('../../database/db');
const GeneticAssignmentService = require('../services/geneticAssignmentService');
const LinearProgrammingAssignmentService = require('../services/linearProgrammingAssignmentService');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');
const AlgorithmComparison = require('../utils/compareAlgorithms');

// Controller methods
const assignmentController = {
    // Get all exams
    getAllExams: async (req, res) => {
        try {
            const result = await client.query('SELECT * FROM ExamSchedule ORDER BY ExamDate, StartTime');
            res.json({
                success: true,
                exams: result.rows
            });
        } catch (error) {
            console.error('Error getting exams:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting exams',
                error: error.message
            });
        }
    },

    // Get assignments for a specific exam
    getExamAssignments: async (req, res) => {
        try {
            const { examId } = req.params;
            const result = await client.query(`
                SELECT 
                    ea.*,
                    o.Name as ObserverName,
                    o.Title as ObserverTitle
                FROM ExamAssignment ea
                JOIN Observer o ON ea.ObserverID = o.ObserverID
                WHERE ea.ExamID = $1 AND ea.Status = 'active'
            `, [examId]);
            
            res.json({
                success: true,
                assignments: result.rows
            });
        } catch (error) {
            console.error('Error getting exam assignments:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting exam assignments',
                error: error.message
            });
        }
    },

    // Get assignments for a specific observer
    getObserverAssignments: async (req, res) => {
        try {
            const { observerId } = req.params;
            const result = await client.query(`
                SELECT 
                    ea.*,
                    e.ExamName,
                    e.ExamDate,
                    e.StartTime,
                    e.EndTime
                FROM ExamAssignment ea
                JOIN ExamSchedule e ON ea.ExamID = e.ExamID
                WHERE ea.ObserverID = $1 AND ea.Status = 'active'
                ORDER BY e.ExamDate, e.StartTime
            `, [observerId]);
            
            res.json({
                success: true,
                assignments: result.rows
            });
        } catch (error) {
            console.error('Error getting observer assignments:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting observer assignments',
                error: error.message
            });
        }
    },

    // Manual assignment of observers
    assignObservers: async (req, res) => {
        try {
            const { examId } = req.params;
            const { headId, secretaryId } = req.body;

            await client.query('BEGIN');

            // Deactivate existing assignments
            await client.query(
                'UPDATE ExamAssignment SET Status = $1 WHERE ExamID = $2 AND Status = $3',
                ['inactive', examId, 'active']
            );

            // Create new assignments
            await client.query(`
                INSERT INTO ExamAssignment (ExamID, ObserverID, Role, Status)
                VALUES ($1, $2, 'head', 'active'), ($1, $3, 'secretary', 'active')
            `, [examId, headId, secretaryId]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Observers assigned successfully'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error assigning observers:', error);
            res.status(500).json({
                success: false,
                message: 'Error assigning observers',
                error: error.message
            });
        }
    },

    // Handle observer unavailability
    handleObserverUnavailability: async (req, res) => {
        try {
            const { examId, observerId } = req.params;
            const { reason } = req.body;

            // Get exam details
            const examResult = await client.query(
                'SELECT * FROM ExamSchedule WHERE ExamID = $1',
                [examId]
            );

            if (examResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Exam not found'
                });
            }

            await client.query('BEGIN');
            
            // Mark observer as unavailable for this exam
            await client.query(`
                INSERT INTO ObserverUnavailability (ObserverID, ExamID, Reason)
                VALUES ($1, $2, $3)
            `, [observerId, examId, reason]);

            // Deactivate any existing assignments
            await client.query(`
                UPDATE ExamAssignment 
                SET Status = 'inactive'
                WHERE ExamID = $1 AND ObserverID = $2 AND Status = 'active'
            `, [examId, observerId]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Observer unavailability recorded'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error handling observer unavailability:', error);
            res.status(500).json({
                success: false,
                message: 'Error handling observer unavailability',
                error: error.message
            });
        }
    },

    // Get available observers for an exam
    getAvailableObservers: async (req, res) => {
        try {
            const { examId } = req.params;
            
            // Get exam details
            const examResult = await client.query(
                'SELECT * FROM ExamSchedule WHERE ExamID = $1',
                [examId]
            );

            if (examResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Exam not found'
                });
            }

            const exam = examResult.rows[0];

            // Get all observers with their time slots
        const observersResult = await client.query(`
            SELECT 
                    o.*,
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
                GROUP BY o.ObserverID, o.Name, o.Title, o.Availability
                ORDER BY o.Name
        `);
        
        // Get existing conflicts
        const conflictsResult = await client.query(`
            SELECT 
                ea.ObserverID,
                es.ExamDate,
                es.StartTime,
                    es.EndTime
            FROM ExamAssignment ea
            JOIN ExamSchedule es ON ea.ExamID = es.ExamID
            WHERE ea.Status = 'active'
                AND es.ExamDate = $1
            `, [exam.examdate]);

            // Filter available observers
            const availableObservers = observersResult.rows.filter(observer => {
                // Check if observer has any conflicts
                const hasConflict = conflictsResult.rows.some(conflict => 
                    conflict.observerid === observer.observerid &&
                    exam.starttime < conflict.endtime &&
                    exam.endtime > conflict.starttime
                );

                if (hasConflict) return false;

                // Check time slot availability for part-time observers
                if (observer.availability === 'part-time') {
                const slots = observer.time_slots || [];
                    const examDay = new Date(exam.examdate).toLocaleString('en-US', { weekday: 'long' });
                    
                    return slots.some(slot => 
                        slot.day.toLowerCase() === examDay.toLowerCase() &&
                        slot.startTime <= exam.starttime &&
                        slot.endTime >= exam.endtime
                    );
                }

                return true;
            });

            res.json({
                success: true,
                observers: availableObservers
            });

        } catch (error) {
            console.error('Error getting available observers:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting available observers',
                error: error.message
            });
        }
    },

    // Get assignment statistics
    getAssignmentStats: async (req, res) => {
        try {
            const stats = await AssignmentQualityMetrics.calculateOverallStats(client);
            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('Error getting assignment stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting assignment statistics',
                error: error.message
            });
        }
    },

    // Get performance history
    getPerformanceHistory: async (req, res) => {
        try {
            const history = await AlgorithmComparison.getPerformanceHistory();
            res.json({
                success: true,
                history: history
            });
        } catch (error) {
            console.error('Error getting performance history:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting performance history',
                error: error.message
            });
        }
    },

    // Get performance statistics
    getPerformanceStats: async (req, res) => {
        try {
            const stats = await AlgorithmComparison.getPerformanceStats();
            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('Error getting performance stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting performance statistics',
                error: error.message
            });
        }
    },

    // Assign observers using genetic algorithm
    assignObserversWithGA: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const gaOptions = req.body;

            // Validate required GA parameters
            if (!gaOptions || !gaOptions.populationSize || !gaOptions.generations || 
                !gaOptions.mutationRate || !gaOptions.crossoverRate || !gaOptions.elitismRate) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required genetic algorithm parameters'
                });
            }

            // Get exam IDs for the schedule
            const examsResult = await client.query(
                'SELECT ExamID FROM ExamSchedule WHERE ScheduleID = $1',
                [scheduleId]
            );

            if (examsResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No exams found for this schedule'
                });
            }

            const examIds = examsResult.rows.map(row => row.examid);

            // Initialize GA service with options
            const gaService = new GeneticAssignmentService(gaOptions);

            // Run GA
            const results = await gaService.assignObserversWithGA(examIds);

            res.json({
                success: true,
                results: results
            });

        } catch (error) {
            console.error('Error in GA assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Error in genetic algorithm assignment',
                error: error.message
            });
        }
    },

    // Assign observers using linear programming
    assignObserversWithLP: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const lpOptions = req.body;

            // Get exam IDs for the schedule
            const examsResult = await client.query(
                'SELECT ExamID FROM ExamSchedule WHERE ScheduleID = $1',
                [scheduleId]
            );

            if (examsResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No exams found for this schedule'
                });
            }

            const examIds = examsResult.rows.map(row => row.examid);

            // Initialize LP service with options
            const lpService = new LinearProgrammingAssignmentService(lpOptions);

            // Run LP
            const results = await lpService.assignObserversWithLP(examIds);

            res.json({
                success: true,
                results: results
            });

        } catch (error) {
            console.error('Error in LP assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Error in linear programming assignment',
                error: error.message
            });
        }
    },

    // Run and compare algorithms
    runAndCompareAlgorithms: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const { gaOptions, lpOptions } = req.body;

            const comparison = await AlgorithmComparison.runAndCompare(
                scheduleId,
                gaOptions,
                lpOptions
            );

            res.json({
                success: true,
                comparison: comparison
            });
        } catch (error) {
            console.error('Error comparing algorithms:', error);
            res.status(500).json({
                success: false,
                message: 'Error comparing algorithms',
                error: error.message
                });
            }
        }
};

module.exports = assignmentController;