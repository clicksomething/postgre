// routes/timeSlotRouter.js
const express = require('express');
const { addTimeSlot, updateTimeSlot, deleteTimeSlot } = require('../controllers/timeslotController');

const router = express.Router();

// Route to add a new time slot
router.post('/timeslots', addTimeSlot);

// Route to update a time slot
router.put('/timeslots/:timeSlotID', updateTimeSlot);

// Route to delete a time slot
router.delete('/timeslots/:timeSlotID', deleteTimeSlot);

module.exports = router;
