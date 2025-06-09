import React, { useState } from 'react';
import './AddTimeSlotModal.scss';
import { FaSave, FaTimes } from 'react-icons/fa';

const AddTimeSlotModal = ({ observerID, day, onClose, onSave }) => {
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const handleSubmit = () => {
        if (!startTime || !endTime) {
            alert('Please fill in both start and end times.');
            return;
        }

        const formattedStartTime = startTime + ':00';
        const formattedEndTime = endTime + ':00';

        const newTimeSlot = {
            startTime: formattedStartTime,
            endTime: formattedEndTime,
            day,
            observerID: Number(observerID), // Ensure observerID is a number
        };
        
        console.log('New time slot:', newTimeSlot);

        onSave(newTimeSlot);
        onClose();
    };

    return (
        <div className="add-time-slot-modal">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>
                    <FaTimes />
                </span>
                <h2>Add Time Slot</h2>
                <div className="form-group">
                    <label htmlFor="startTime">Start Time:</label>
                    <input
                        type="time"
                        id="startTime"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="endTime">End Time:</label>
                    <input
                        type="time"
                        id="endTime"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
                <button className="save-button" onClick={handleSubmit}>
                    <FaSave /> Save
                </button>
            </div>
        </div>
    );
};

export default AddTimeSlotModal;