const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const multer = require('multer');
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage });

// Route to create a new exam
router.post('/', examController.createExam);

// Route to get all exams
router.get('/', examController.getAllExams);

// Route to get an exam by ID
router.get('/:id', examController.getExamById);

// Route to update an exam
router.put('/:id', examController.updateExam);

// Route to delete an exam
router.delete('/:id', examController.deleteExam);

// Route to upload exam schedule
router.post('/upload', upload.single('file'), examController.uploadExamSchedule);

module.exports = router;
