const AssignmentService = require('../services/assignmentService');
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
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.roleId !== 2) { // Admin role ID
                console.warn(`[ASSIGNMENT CONTROLLER] Unauthorized access attempt`, {
                    roleId: decoded.roleId,
                    userId: decoded.userId
                });
                return res.status(403).json({ message: 'Only administrators can assign observers' });
            }

            const { examId } = req.params;

            try {
                const result = await AssignmentService.assignObserversToExam(examId);
                res.json(result);
            } catch (assignmentError) {
                console.error(`[ASSIGNMENT CONTROLLER] Assignment Error Details:`, {
                    message: assignmentError.message,
                    stack: assignmentError.stack,
                    name: assignmentError.name
                });
                res.status(500).json({ 
                    message: 'Failed to assign observers', 
                    errorDetails: assignmentError.message 
                });
            }
        } catch (authError) {
            console.error(`[ASSIGNMENT CONTROLLER] Authentication Error:`, {
                message: authError.message,
                stack: authError.stack,
                name: authError.name
            });
            res.status(401).json({ message: 'Authentication failed' });
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
    }

};

module.exports = assignmentController; 