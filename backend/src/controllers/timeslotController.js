// controllers/TimeSlotController.js
const { client } = require('../../database/db');// Adjust according to your database setup

// controllers/TimeSlotController.js
const addTimeSlot = async (req, res) => {
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

        // Check for existing time slots for the same observer on the same day and overlapping times
        const existingTimeSlot = await client.query(
            `SELECT * FROM TimeSlot 
             WHERE ObserverID = $1 AND day = $2 
             AND (
                 (StartTime < $3 AND EndTime > $3) OR 
                 (StartTime < $4 AND EndTime > $4) OR
                 (StartTime >= $3 AND EndTime <= $4)
             )`,
            [observerID, day, startTime, endTime]
        );

        if (existingTimeSlot.rows.length > 0) {
            return res.status(400).json({ message: 'A time slot already exists for this observer on this day with overlapping times.' });
        }

        // Insert time slot into the database
        const result = await client.query(
            `INSERT INTO TimeSlot (StartTime, EndTime, day, ObserverID)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [startTime, endTime, day, observerID]
        );

        // Return the newly created time slot
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding time slot:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
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
