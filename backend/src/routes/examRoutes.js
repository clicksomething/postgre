const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Configure Multer

router.post('/', examController.createExam);
router.get('/', examController.getAllExams);
router.get('/:id', examController.getExamById);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);
router.post('/upload', upload.single('file'), examController.uploadExamSchedule);

module.exports = router;
