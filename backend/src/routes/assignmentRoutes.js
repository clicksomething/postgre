const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const AlgorithmComparison = require('../utils/compareAlgorithms');

// All routes should be protected
router.use(authenticateToken);

// Assignment routes
router.get('/exams', assignmentController.getAllExams);
router.get('/exams/:examId/assignments', assignmentController.getExamAssignments);
router.get('/observers/:observerId/assignments', assignmentController.getObserverAssignments);
router.post('/exams/:examId/assign', assignmentController.assignObservers);
router.post('/exams/:examId/observers/:observerId/unavailable', assignmentController.handleObserverUnavailability);
router.get('/exams/:examId/available-observers', assignmentController.getAvailableObservers);
router.get('/statistics', assignmentController.getAssignmentStats);
router.get('/performance/history', assignmentController.getPerformanceHistory);
router.get('/performance/stats', assignmentController.getPerformanceStats);

// Genetic algorithm assignment
router.post('/schedules/:scheduleId/assign-genetic', assignmentController.assignObserversWithGA);



// Run and compare algorithms
router.post('/schedules/:scheduleId/compare-algorithms', assignmentController.runAndCompareAlgorithms);

// Handle unavailability with file upload support
router.post(
    '/exams/:examId/observers/:observerId/unavailable',
    upload.single('documentation'), // Optional file upload for documentation
    handleUploadError,
    assignmentController.handleObserverUnavailability
);

// Algorithm comparison routes
router.get('/algorithms/compare', async (req, res) => {
    try {
        const comparison = await AlgorithmComparison.compareLatestReports();
        if (!comparison) {
            return res.status(404).json({
                success: false,
                message: 'No reports found to compare. Please run both algorithms first.'
            });
        }
        
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
});

router.get('/algorithms/trends', async (req, res) => {
    try {
        const trends = await AlgorithmComparison.analyzeSummaryTrends();
        res.json({
            success: true,
            trends: trends
        });
    } catch (error) {
        console.error('Error analyzing trends:', error);
        res.status(500).json({
            success: false,
            message: 'Error analyzing trends',
            error: error.message
        });
    }
});

module.exports = router; 