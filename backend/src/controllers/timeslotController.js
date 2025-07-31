// controllers/TimeSlotController.js
const { client } = require('../../database/db');// Adjust according to your database setup
const { 
  parseTimeToMinutes,
  formatTimeForDisplay 
} = require('../utils/dateTimeUtils');

// controllers/TimeSlotController.js
const addTimeSlot = async (req, res) => {
    const { startTime, endTime, day, observerID } = req.body;

    // Log raw input for debugging
    console.log('Time Slot Insertion Request:', {
        startTime, 
        endTime, 
        day, 
        observerID,
        startTimeType: typeof startTime,
        endTimeType: typeof endTime,
        dayType: typeof day,
        observerIDType: typeof observerID
    });

    // Validate required fields
    if (!startTime) {
        return res.status(400).json({ message: 'Start time is required' });
    }

    if (!endTime) {
        return res.status(400).json({ message: 'End time is required' });
    }

    if (!day) {
        return res.status(400).json({ message: 'Day is required' });
    }

    if (!observerID) {
        return res.status(400).json({ message: 'Observer ID is required' });
    }

    try {
        // Check if the observer exists and get their availability
        const observerResult = await client.query(
            `SELECT availability FROM Observer WHERE ObserverID = $1`,
            [observerID]
        );

        if (observerResult.rows.length === 0) {
            return res.status(404).json({ message: 'Observer not found' });
        }

        // Check if observer is full-time
        if (observerResult.rows[0].availability === 'full-time') {
            return res.status(400).json({ 
                message: 'Cannot add time slots for full-time observers' 
            });
        }

        // Validate and potentially adjust times for cross-midnight slots using bulletproof utilities
        let adjustedStartTime = formatTimeForDisplay(startTime, false);
        let adjustedEndTime = formatTimeForDisplay(endTime, false);
        let adjustedDay = day;

        // If end time is earlier than start time, assume it crosses midnight
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);

        if (endMinutes < startMinutes) {
            console.log('Cross-midnight time slot detected');
            // Adjust day for the end time
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDayIndex = days.indexOf(day.toLowerCase());
            const nextDayIndex = (currentDayIndex + 1) % 7;
            
            console.log('Original Day:', day);
            console.log('Next Day:', days[nextDayIndex]);
        }

        // Check for existing time slots for the same observer on the same day and overlapping times
        const existingTimeSlot = await client.query(
            `SELECT * FROM TimeSlot 
             WHERE ObserverID = $1 AND day = $2 
             AND (
                 (StartTime < $3 AND EndTime > $3) OR 
                 (StartTime < $4 AND EndTime > $4) OR
                 (StartTime >= $3 AND EndTime <= $4)
             )`,
            [observerID, adjustedDay, adjustedStartTime, adjustedEndTime]
        );

        if (existingTimeSlot.rows.length > 0) {
            return res.status(400).json({ message: 'A time slot already exists for this observer on this day with overlapping times.' });
        }

        // Insert time slot into the database
        const result = await client.query(
            `INSERT INTO TimeSlot (StartTime, EndTime, day, ObserverID)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [adjustedStartTime, adjustedEndTime, adjustedDay, observerID]
        );

        // Log successful insertion
        console.log('Time Slot Inserted Successfully:', result.rows[0]);

        // Return the newly created time slot
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding time slot:', error);
        return res.status(500).json({ 
            message: 'Internal Server Error',
            errorDetails: error.message,
            errorStack: error.stack
        });
    }
};
const updateTimeSlot = async (req, res) => {
    const timeSlotID = parseInt(req.params.timeSlotID); // Convert to integer explicitly
    
    if (isNaN(timeSlotID)) {
        return res.status(400).json({ message: 'Invalid TimeSlotID format' });
    }

    const { startTime, endTime, day, observerID } = req.body;

    // Validate required fields
    if (!startTime) {
        return res.status(400).json({ message: 'Start time is required' });
    }

    if (!endTime) {
        return res.status(400).json({ message: 'End time is required' });
    }

    if (!day) {
        return res.status(400).json({ message: 'Day is required' });
    }

    if (!observerID) {
        return res.status(400).json({ message: 'Observer ID is required' });
    }

    try {
        // Check if the time slot exists
        const timeSlotExists = await client.query(
            `SELECT * FROM TimeSlot WHERE TimeSlotID = $1`,
            [timeSlotID]
        );

        if (timeSlotExists.rows.length === 0) {
            return res.status(404).json({ message: 'Time slot not found' });
        }

        // Check if the observer exists
        const observerExists = await client.query(
            `SELECT * FROM Observer WHERE ObserverID = $1`,
            [observerID]
        );

        if (observerExists.rows.length === 0) {
            return res.status(404).json({ message: 'Observer not found' });
        }

        // Check observer's availability
        const observerResult = await client.query(
            `SELECT availability FROM Observer WHERE ObserverID = $1`,
            [observerID]
        );

        if (observerResult.rows[0].availability === 'full-time') {
            return res.status(400).json({ 
                message: 'Cannot update time slots for full-time observers' 
            });
        }

        // Update the time slot in the database
        const result = await client.query(
            `UPDATE TimeSlot 
             SET StartTime = $1, EndTime = $2, day = $3, ObserverID = $4
             WHERE TimeSlotID = $5 RETURNING *`,
            [startTime, endTime, day, observerID, timeSlotID]
        );

        // Return the updated time slot
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating time slot:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const deleteTimeSlot = async (req, res) => {
    const { timeSlotID } = req.params; // Get the timeSlotID from the request parameters

    try {
        // Check if the time slot exists
        const timeSlotExists = await client.query(
            `SELECT * FROM TimeSlot WHERE TimeSlotID = $1`,
            [timeSlotID]
        );

        if (timeSlotExists.rows.length === 0) {
            return res.status(404).json({ message: 'Time slot not found' });
        }

        // Delete the time slot from the database
        await client.query(
            `DELETE FROM TimeSlot WHERE TimeSlotID = $1`,
            [timeSlotID]
        );

        // Return a success message
        return res.status(200).json({ message: 'Time slot deleted successfully' });
    } catch (error) {
        console.error('Error deleting time slot:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { addTimeSlot, deleteTimeSlot, updateTimeSlot };
