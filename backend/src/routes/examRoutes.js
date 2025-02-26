const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

// Routes (no /api/exams prefix needed - it's already added in index.js)
router.get('/schedules/all', authenticateToken, examController.getSchedules);
router.get('/schedules/:scheduleId', authenticateToken, examController.getScheduleDetails);
router.post('/upload', 
    authenticateToken,                  // First check if user is authenticated
    upload.single('file'),             // Then handle file upload
    handleUploadError,                 // Handle any upload errors
    examController.uploadExamSchedule   // Finally process the upload
);
router.put('/:examId', authenticateToken, examController.updateExam);  // Using updateExam instead of editExam
router.delete('/:examId', authenticateToken, examController.deleteExam);
router.delete('/schedules/:scheduleId', authenticateToken, examController.deleteSchedule);

module.exports = router;

