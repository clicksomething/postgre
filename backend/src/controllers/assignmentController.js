const AssignmentService = require('../services/assignmentService');
const GeneticAssignmentService = require('../services/geneticAssignmentService');
const { client } = require('../../database/db');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

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
                populationSize = 50,
                generations = 100,
                mutationRate = 0.1,
                crossoverRate = 0.7,
                elitismRate = 0.1
            } = req.body;

            // Validate parameters
            if (populationSize < 10 || populationSize > 200) {
                return res.status(400).json({ message: 'Population size must be between 10 and 200' });
            }
            if (generations < 10 || generations > 500) {
                return res.status(400).json({ message: 'Generations must be between 10 and 500' });
            }
            if (mutationRate < 0 || mutationRate > 1) {
                return res.status(400).json({ message: 'Mutation rate must be between 0 and 1' });
            }
            if (crossoverRate < 0 || crossoverRate > 1) {
                return res.status(400).json({ message: 'Crossover rate must be between 0 and 1' });
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
            const gaService = new GeneticAssignmentService({
                populationSize,
                generations,
                mutationRate,
                crossoverRate,
                elitismRate
            });

            // Run genetic algorithm
            const result = await gaService.assignObserversWithGA(examIds);

            // Format response
            const response = {
                message: "Genetic algorithm assignment complete",
                scheduleId: scheduleId,
                algorithm: 'genetic',
                parameters: {
                    populationSize,
                    generations,
                    mutationRate,
                    crossoverRate,
                    elitismRate
                },
                totalExams: result.successful.length + result.failed.length,
                assignedExams: result.successful.length,
                failedExams: result.failed.length,
                fitness: result.performance.finalFitness,
                convergenceGeneration: result.performance.convergenceGeneration,
                assignments: result.successful.map(s => ({
                    examId: s.examId,
                    examName: s.examName,
                    headObserver: s.head,
                    secretary: s.secretary
                })),
                failed: result.failed,
                performance: result.performance
            };

            res.json(response);
        } catch (error) {
            console.error('Error in genetic algorithm assignment:', error);
            res.status(500).json({
                message: "Failed to assign observers using genetic algorithm",
                error: error.message
            });
        }
    }

};

module.exports = assignmentController; 