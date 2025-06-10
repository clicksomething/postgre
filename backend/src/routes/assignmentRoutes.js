const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

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

// Handle unavailability with file upload support
router.post(
    '/exams/:examId/observers/:observerId/unavailable',
    upload.single('documentation'), // Optional file upload for documentation
    handleUploadError,
    assignmentController.handleObserverUnavailability
);

module.exports = router; 