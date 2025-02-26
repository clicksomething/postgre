// routes/timeSlotRouter.js
const express = require('express');
const { addTimeSlot, updateTimeSlot, deleteTimeSlot } = require('../controllers/timeslotController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Route to add a new time slot
router.post('/', addTimeSlot);

// Route to update a time slot
router.put('/:timeSlotID', updateTimeSlot);

// Route to delete a time slot
router.delete('/:timeSlotID', deleteTimeSlot);

module.exports = router;
