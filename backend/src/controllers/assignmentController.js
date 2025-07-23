const AssignmentService = require('../services/assignmentService');
const GeneticAssignmentService = require('../services/geneticAssignmentService');
const LinearProgrammingAssignmentService = require('../services/linearProgrammingAssignmentService');
const { client } = require('../../database/db');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const AlgorithmComparison = require('../utils/compareAlgorithms');



const assignmentController = {
    // Get all exams with their assignment status
    getAllExams: async (req, res) => {
        try {
            const result = await client.query(`
                SELECT 
                    e.*,
                    COALESCE(head.Name, '-') as head_observer,
                    COALESCE(sec.Name, '-') as secretary,
                    CASE 
                        WHEN e.ExamHead IS NOT NULL AND e.ExamSecretary IS NOT NULL THEN 'assigned'
                        WHEN e.ExamHead IS NOT NULL OR e.ExamSecretary IS NOT NULL THEN 'partially_assigned'
                        ELSE 'unassigned'
                    END as status
                FROM ExamSchedule e
                LEFT JOIN Observer head ON e.ExamHead = head.ObserverID
                LEFT JOIN Observer sec ON e.ExamSecretary = sec.ObserverID
                ORDER BY e.ExamDate, e.StartTime
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching exams:', error);
            res.status(500).json({ message: 'Failed to fetch exams' });
        }
    },

    // Get assignments for a specific exam
    getExamAssignments: async (req, res) => {
        const { examId } = req.params;
        try {
            const result = await client.query(`
                SELECT ea.*, o.Name as ObserverName, o.Title
                FROM ExamAssignment ea
                JOIN Observer o ON ea.ObserverID = o.ObserverID
                WHERE ea.ExamID = $1
            `, [examId]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching exam assignments:', error);
            res.status(500).json({ message: 'Failed to fetch exam assignments' });
        }
    },

    // Get assignments for a specific observer
    getObserverAssignments: async (req, res) => {
        const { observerId } = req.params;
        try {
            const result = await client.query(`
                SELECT ea.*, e.ExamName
                FROM ExamAssignment ea
                JOIN ExamSchedule e ON ea.ExamID = e.ExamID
                WHERE ea.ObserverID = $1
            `, [observerId]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching observer assignments:', error);
            res.status(500).json({ message: 'Failed to fetch observer assignments' });
        }
    },

    // Assign observers to a specific exam
    assignObservers: async (req, res) => {
        try {
            // User is already authenticated by middleware
            // No need to check for admin role - matching randomDistribution behavior

            const { examId } = req.params;

                const result = await AssignmentService.assignObserversToExam(examId);
                res.json(result);
        } catch (error) {
            console.error(`[ASSIGNMENT CONTROLLER] Error:`, {
                message: error.message,
                stack: error.stack,
                name: error.name
                });
                res.status(500).json({ 
                    message: 'Failed to assign observers', 
                errorDetails: error.message 
                });
        }
    },

    // Handle observer unavailability and reassignment
    handleObserverUnavailability: async (req, res) => {
        const { examId, observerId } = req.params;
        const { reason } = req.body;

        try {
            await client.query('BEGIN');

            // Check if the exam is in the future
            const examCheck = await client.query(`
                SELECT ExamDate, StartTime, Status
                FROM ExamSchedule 
                WHERE ExamID = $1
            `, [examId]);

            if (examCheck.rows.length === 0) {
                return res.status(404).json({
                    message: 'Exam not found'
                });
            }

            const examDate = new Date(examCheck.rows[0].ExamDate);
            if (examDate < new Date()) {
                return res.status(400).json({
                    message: 'Cannot modify assignments for past exams'
                });
            }

            // Check if observer is actually assigned to this exam
            const isAssigned = await client.query(`
                SELECT 1 
                FROM ExamSchedule 
                WHERE ExamID = $1 
                AND (ExamHead = $2 OR ExamSecretary = $2)
            `, [examId, observerId]);

            if (isAssigned.rows.length === 0) {
                return res.status(400).json({
                    message: 'Observer is not assigned to this exam'
                });
            }

            await AssignmentService.handleObserverUnavailability(examId, observerId, reason);
            
            await client.query('COMMIT');
            res.status(200).json({
                message: 'Observer reassigned successfully'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error:', error);
            res.status(500).json({
                message: error.message || 'Failed to handle observer unavailability'
            });
        }
    },

    // Get available observers for an exam
    getAvailableObservers: async (req, res) => {
        const { examId } = req.params;
        try {
            const exam = await AssignmentService.getExamDetails(examId);
            if (!exam) {
                return res.status(404).json({ message: 'Exam not found' });
            }

            const availableObservers = await AssignmentService.getAvailableObservers(exam);
            res.json(availableObservers);
        } catch (error) {
            console.error('Error getting available observers:', error);
            res.status(500).json({ message: 'Failed to get available observers' });
        }
    },

    // Get assignment statistics
    getAssignmentStats: async (req, res) => {
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_assignments,
                    COUNT(DISTINCT ExamID) as total_exams,
                    COUNT(DISTINCT ObserverID) as total_observers
                FROM ExamAssignment
            `);
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching assignment statistics:', error);
            res.status(500).json({ message: 'Failed to fetch assignment statistics' });
        }
    },

    // Get performance history from files
    getPerformanceHistory: async (req, res) => {
        try {
            const { limit = 10, offset = 0 } = req.query;
            const reportsDir = path.join(__dirname, '../../performance-reports');
            
            // Read all performance report files
            let files = [];
            try {
                files = await fs.readdir(reportsDir);
                files = files.filter(f => f.startsWith('assignment-performance-') && f.endsWith('.json'));
            } catch (err) {
                // Directory might not exist yet
                return res.json({ performances: [], total: 0 });
            }
            
            // Sort files by timestamp (newest first)
            files.sort().reverse();
            
            // Apply pagination
            const paginatedFiles = files.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            
            // Read the performance reports
            const performances = [];
            for (const file of paginatedFiles) {
                try {
                    const content = await fs.readFile(path.join(reportsDir, file), 'utf8');
                    const report = JSON.parse(content);
                    performances.push({
                        filename: file,
                        ...report
                    });
                } catch (err) {
                    console.error(`Error reading performance file ${file}:`, err);
                }
            }
            
            res.json({
                performances,
                total: files.length
            });
        } catch (error) {
            console.error('Error fetching performance history:', error);
            res.status(500).json({ message: 'Failed to fetch performance history' });
        }
    },

    // Get performance statistics summary from summary file
    getPerformanceStats: async (req, res) => {
        try {
            const { days = 7 } = req.query;
            const reportsDir = path.join(__dirname, '../../performance-reports');
            const summaryFile = path.join(reportsDir, 'performance-summary.jsonl');
            
            let summaryLines = [];
            try {
                const content = await fs.readFile(summaryFile, 'utf8');
                summaryLines = content.trim().split('\n').filter(line => line);
            } catch (err) {
                // File might not exist yet
                return res.json({
                    dailyStats: [],
                    overallStats: {
                        totalOperations: 0,
                        avgTimeMs: 0,
                        avgExamsPerSecond: 0,
                        bestTimeMs: null,
                        worstTimeMs: null
                    },
                    period: `${days} days`
                });
            }
            
            // Parse all summary lines
            const allSummaries = summaryLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (err) {
                    return null;
                }
            }).filter(s => s !== null);
            
            // Filter by date range
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            
            const recentSummaries = allSummaries.filter(s => 
                new Date(s.timestamp) >= cutoffDate
            );
            
            // Calculate daily statistics
            const dailyStats = {};
            recentSummaries.forEach(summary => {
                const date = new Date(summary.timestamp).toISOString().split('T')[0];
                if (!dailyStats[date]) {
                    dailyStats[date] = {
                        date,
                        operations: [],
                        totalExams: 0
                    };
                }
                dailyStats[date].operations.push(summary);
                dailyStats[date].totalExams += summary.examCount;
            });
            
            // Calculate aggregated daily stats
            const dailyStatsArray = Object.values(dailyStats).map(day => {
                const times = day.operations.map(op => parseFloat(op.totalTimeMs));
                const examsPerSec = day.operations.map(op => parseFloat(op.examsPerSecond));
                
                return {
                    date: day.date,
                    totalOperations: day.operations.length,
                    totalExamsProcessed: day.totalExams,
                    avgDurationMs: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
                    avgExamsPerSecond: (examsPerSec.reduce((a, b) => a + b, 0) / examsPerSec.length).toFixed(2),
                    maxExamsPerSecond: Math.max(...examsPerSec).toFixed(2),
                    bestTimeMs: Math.min(...times),
                    worstTimeMs: Math.max(...times)
                };
            }).sort((a, b) => b.date.localeCompare(a.date));
            
            // Calculate overall statistics
            const allTimes = recentSummaries.map(s => parseFloat(s.totalTimeMs));
            const allExamsPerSec = recentSummaries.map(s => parseFloat(s.examsPerSecond));
            
            const overallStats = {
                totalOperations: recentSummaries.length,
                totalExamsProcessed: recentSummaries.reduce((sum, s) => sum + s.examCount, 0),
                avgDurationMs: allTimes.length > 0 ? 
                    (allTimes.reduce((a, b) => a + b, 0) / allTimes.length).toFixed(2) : 0,
                avgExamsPerSecond: allExamsPerSec.length > 0 ?
                    (allExamsPerSec.reduce((a, b) => a + b, 0) / allExamsPerSec.length).toFixed(2) : 0,
                maxExamsPerSecond: allExamsPerSec.length > 0 ? 
                    Math.max(...allExamsPerSec).toFixed(2) : 0,
                bestTimeMs: allTimes.length > 0 ? Math.min(...allTimes) : null,
                worstTimeMs: allTimes.length > 0 ? Math.max(...allTimes) : null
            };
            
            res.json({
                dailyStats: dailyStatsArray,
                overallStats,
                period: `${days} days`
            });
        } catch (error) {
            console.error('Error fetching performance statistics:', error);
            res.status(500).json({ message: 'Failed to fetch performance statistics' });
        }
    },

    // Assign observers using genetic algorithm
    assignObserversWithGA: async (req, res) => {
        try {
            // User is already authenticated by middleware
            // No need to check for admin role - matching randomDistribution behavior

            const { scheduleId } = req.params;
            const { 
                populationSize,
                generations,
                mutationRate,
                crossoverRate,
                elitismRate,
                useDeterministicInit
            } = req.body;

            // Validate that required parameters are provided
            if (!populationSize || !generations || !mutationRate || !crossoverRate || !elitismRate) {
                return res.status(400).json({ 
                    message: 'All genetic algorithm parameters must be provided: populationSize, generations, mutationRate, crossoverRate, elitismRate' 
                });
            }

            // Get all exam IDs for this schedule
            const examsResult = await client.query(
                `SELECT ExamID FROM ExamSchedule WHERE ScheduleID = $1`,
                [scheduleId]
            );

            if (examsResult.rows.length === 0) {
                return res.status(404).json({ message: 'No exams found for this schedule' });
            }

            const examIds = examsResult.rows.map(row => row.examid);

            // Create GA service with custom parameters
            console.log('[GA] Using parameters from frontend:', {
                populationSize,
                generations,
                mutationRate,
                crossoverRate,
                elitismRate,
                useDeterministicInit
            });
            
            const gaService = new GeneticAssignmentService({
                populationSize,
                generations,
                mutationRate,
                crossoverRate,
                elitismRate,
                useDeterministicInit
            });



            // Start the genetic algorithm in a non-blocking way
            console.log('[GA] Starting genetic algorithm in background...');
            
            // Send immediate response that the algorithm has started
            res.json({
                message: "Genetic algorithm started",
                scheduleId: scheduleId,
                algorithm: 'genetic',
                parameters: {
                    populationSize,
                    generations,
                    mutationRate,
                    crossoverRate,
                    elitismRate
                },
                status: 'running'
            });

            // Run the genetic algorithm in the background
            setImmediate(async () => {
                try {
                    console.log('[GA] Running genetic algorithm in background...');
                    const result = await gaService.assignObserversWithGA(examIds);
                    
                    console.log('[GA] Genetic algorithm completed successfully');
                    console.log('[GA] Results:', {
                        totalExams: result.successful.length + result.failed.length,
                        assignedExams: result.successful.length,
                        failedExams: result.failed.length,
                        fitness: result.performance.finalFitness
                    });
                } catch (error) {
                    console.error('[GA] Error in background genetic algorithm:', error);
                }
            });
        } catch (error) {
            console.error('Error in genetic algorithm assignment:', error);
            res.status(500).json({
                message: "Failed to assign observers using genetic algorithm",
                error: error.message
            });
        }
    },

    // Assign observers using linear programming (lexicographic)
    assignObserversWithLP: async (req, res) => {
        try {
            const { scheduleId } = req.params;

            // Get all exam IDs for this schedule
            const examsResult = await client.query(
                `SELECT ExamID FROM ExamSchedule WHERE ScheduleID = $1`,
                [scheduleId]
            );

            if (examsResult.rows.length === 0) {
                return res.status(404).json({ message: 'No exams found for this schedule' });
            }

            const examIds = examsResult.rows.map(row => row.examid);

            // Create LP service
            console.log('[LP] Starting linear programming assignment...');
            
            const lpService = new LinearProgrammingAssignmentService();

            // Run the LP algorithm synchronously to prevent race conditions
            try {
                console.log('[LP] Running linear programming algorithm...');
                const result = await lpService.assignObserversWithLP(examIds);
                
                console.log('[LP] Linear programming algorithm completed successfully');
                console.log('[LP] Results:', {
                    totalExams: result.successful.length + result.failed.length,
                    assignedExams: result.successful.length,
                    failedExams: result.failed.length,
                    fitness: result.performance.finalFitness
                });
                
                // Send success response
                res.json({
                    message: "Linear programming algorithm completed successfully",
                    scheduleId: scheduleId,
                    algorithm: 'linear_programming_lexicographic',
                    status: 'completed',
                    results: {
                        totalExams: result.successful.length + result.failed.length,
                        assignedExams: result.successful.length,
                        failedExams: result.failed.length,
                        successRate: ((result.successful.length / (result.successful.length + result.failed.length)) * 100).toFixed(1) + '%'
                    }
                });
            } catch (error) {
                console.error('[LP] Error in linear programming algorithm:', error);
                res.status(500).json({ 
                    message: 'Error in linear programming algorithm',
                    error: error.message 
                });
            }

        } catch (error) {
            console.error('[LP] Error in linear programming assignment:', error);
            res.status(500).json({ 
                message: 'Error starting linear programming algorithm',
                error: error.message 
            });
        }
    },

    // Run both algorithms and compare
    runAndCompareAlgorithms: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            
            // Validate schedule exists
            const scheduleCheck = await client.query(
                'SELECT COUNT(*) as count FROM ExamSchedule WHERE ScheduleID = $1',
                [scheduleId]
            );
            
            if (scheduleCheck.rows[0].count === '0') {
                return res.status(404).json({
                    success: false,
                    message: 'Schedule not found'
                });
            }

            // Get all exams for this schedule with full details
            const examsResult = await client.query(`
                SELECT 
                    es.*,
                    c.CourseName,
                    r.RoomNum
                FROM ExamSchedule es
                JOIN Course c ON es.CourseID = c.CourseID
                JOIN Room r ON es.RoomID = r.RoomID
                WHERE es.ScheduleID = $1
                ORDER BY es.ExamDate, es.StartTime
            `, [scheduleId]);
            
            const exams = examsResult.rows;
            const examIds = exams.map(row => row.examid);
            
            if (examIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No exams found in this schedule'
                });
            }

            console.log(`Running comparison for ${examIds.length} exams in schedule ${scheduleId}`);

            // Get all observers
            const observersResult = await client.query(`
                SELECT * FROM Observer 
                ORDER BY 
                    CASE WHEN Title ILIKE '%dr%' THEN 0 ELSE 1 END,
                    ObserverID
            `);
            const observers = observersResult.rows;

            // Step 1: Run Random Algorithm
            console.log('Running Random Algorithm...');
            const randomStartTime = Date.now();
            
            // Clear any existing assignments first
            await client.query('BEGIN');
            await client.query(
                'DELETE FROM ExamAssignment WHERE ExamID = ANY($1)',
                [examIds]
            );
            await client.query(
                'UPDATE ExamSchedule SET ExamHead = NULL, ExamSecretary = NULL, Status = \'unassigned\' WHERE ExamID = ANY($1)',
                [examIds]
            );
            await client.query('COMMIT');

            // Run random assignment
            const randomResult = await AssignmentService.assignObserversToExam(examIds);
            const randomEndTime = Date.now();
            
            // Save random assignments
            const randomAssignments = await client.query(
                'SELECT * FROM ExamAssignment WHERE ExamID = ANY($1)',
                [examIds]
            );

            // Step 2: Run Genetic Algorithm
            console.log('Running Genetic Algorithm...');
            const geneticStartTime = Date.now();
            
            // Clear assignments again - ensure complete cleanup
            await client.query('BEGIN');
            
            // First, get all existing assignments to ensure we're deleting everything
            const existingAssignments = await client.query(
                'SELECT * FROM ExamAssignment WHERE ExamID = ANY($1)',
                [examIds]
            );
            console.log(`Found ${existingAssignments.rows.length} existing assignments to delete`);
            
            // Delete with explicit confirmation
            const deleteResult = await client.query(
                'DELETE FROM ExamAssignment WHERE ExamID = ANY($1) RETURNING *',
                [examIds]
            );
            console.log(`Deleted ${deleteResult.rows.length} assignments`);
            
            // Update exam schedule to ensure clean state
            await client.query(
                `UPDATE ExamSchedule 
                 SET ExamHead = NULL, ExamSecretary = NULL, Status = 'unassigned' 
                 WHERE ExamID = ANY($1)`,
                [examIds]
            );
            
            await client.query('COMMIT');
            
            // Add a small delay to ensure database consistency
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify cleanup
            const verifyCleanup = await client.query(
                'SELECT COUNT(*) as count FROM ExamAssignment WHERE ExamID = ANY($1)',
                [examIds]
            );
            console.log(`Verification: ${verifyCleanup.rows[0].count} assignments remaining (should be 0)`);
            
            if (verifyCleanup.rows[0].count > 0) {
                console.error('WARNING: Failed to completely clean up assignments. Attempting force cleanup...');
                // Force cleanup with a more aggressive approach
                await client.query('BEGIN');
                await client.query(
                    'DELETE FROM ExamAssignment WHERE ExamID = ANY($1)',
                    [examIds]
                );
                await client.query('COMMIT');
            }

            // Run genetic algorithm
            let geneticResult;
            try {
                // Use parameters from request body
                const { 
                    populationSize,
                    generations,
                    mutationRate,
                    crossoverRate,
                    elitismRate,
                    useDeterministicInit
                } = req.body;

                const geneticService = new GeneticAssignmentService({
                    populationSize,
                    generations,
                    mutationRate,
                    crossoverRate,
                    elitismRate,
                    useDeterministicInit
                });
                geneticResult = await geneticService.assignObserversWithGA(examIds);
            } catch (geneticError) {
                console.error('Error running genetic algorithm:', geneticError);
                
                // If it's a constraint violation, try one more time with complete cleanup
                if (geneticError.code === '23505') {
                    console.log('Constraint violation detected. Performing complete cleanup and retry...');
                    
                    // Complete cleanup
                    await client.query('BEGIN');
                    await client.query('DELETE FROM ExamAssignment WHERE ExamID = ANY($1)', [examIds]);
                    await client.query(
                        `UPDATE ExamSchedule 
                         SET ExamHead = NULL, ExamSecretary = NULL, Status = 'unassigned' 
                         WHERE ExamID = ANY($1)`,
                        [examIds]
                    );
                    await client.query('COMMIT');
                    
                    // Wait a bit longer
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Retry with same parameters from request
                    const { 
                        populationSize,
                        generations,
                        mutationRate,
                        crossoverRate,
                        elitismRate,
                        useDeterministicInit
                    } = req.body;

                    const geneticService = new GeneticAssignmentService({
                        populationSize,
                        generations,
                        mutationRate,
                        crossoverRate,
                        elitismRate,
                        useDeterministicInit
                    });
                    geneticResult = await geneticService.assignObserversWithGA(examIds);
                } else {
                    throw geneticError;
                }
            }
            const geneticEndTime = Date.now();

            // Step 3: Compare the results
            const comparison = await AlgorithmComparison.compareResults(
                {
                    algorithm: 'Random',
                    result: randomResult,
                    executionTime: randomEndTime - randomStartTime,
                    timestamp: new Date(randomStartTime)
                },
                {
                    algorithm: 'Genetic',
                    result: geneticResult,
                    executionTime: geneticEndTime - geneticStartTime,
                    timestamp: new Date(geneticStartTime)
                },
                exams,
                observers
            );

            // Step 4: Decide which result to keep (based on quality score)
            const keepGenetic = comparison['Genetic Algorithm'].overallScore >= 
                               comparison['Random Algorithm'].overallScore;

            if (keepGenetic) {
                console.log('Keeping Genetic Algorithm results (better quality)');
                // Genetic results are already in the database
            } else {
                console.log('Reverting to Random Algorithm results (better quality)');
                // Restore random assignments
                await client.query('BEGIN');
                await client.query(
                    'DELETE FROM ExamAssignment WHERE ExamID = ANY($1)',
                    [examIds]
                );
                
                // Restore random assignments
                for (const assignment of randomAssignments.rows) {
                    await client.query(
                        `INSERT INTO ExamAssignment (ExamID, ScheduleID, ObserverID, Role, Status, ExamDate)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [assignment.examid, assignment.scheduleid, assignment.observerid, 
                         assignment.role, assignment.status, assignment.examdate]
                    );
                }
                
                // Also restore the exam schedule status
                await client.query(
                    `UPDATE ExamSchedule es
                     SET Status = 'assigned',
                         ExamHead = ea_head.ObserverID,
                         ExamSecretary = ea_sec.ObserverID
                     FROM (SELECT ExamID, ObserverID FROM ExamAssignment WHERE Role = 'head' AND ExamID = ANY($1)) ea_head,
                          (SELECT ExamID, ObserverID FROM ExamAssignment WHERE Role = 'secretary' AND ExamID = ANY($1)) ea_sec
                     WHERE es.ExamID = ea_head.ExamID 
                     AND es.ExamID = ea_sec.ExamID`,
                    [examIds]
                );
                
                await client.query('COMMIT');
            }

            res.json({
                success: true,
                comparison: comparison,
                appliedAlgorithm: keepGenetic ? 'Genetic' : 'Random',
                message: `Comparison complete. Applied ${keepGenetic ? 'Genetic' : 'Random'} algorithm results.`
            });

        } catch (error) {
            console.error('Error in runAndCompareAlgorithms:', error);
            res.status(500).json({
                success: false,
                message: 'Error running algorithm comparison',
                error: error.message
            });
        }
    }

};

module.exports = assignmentController; 