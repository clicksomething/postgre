import React, { useState } from 'react';
import './EditTimeSlotModal.scss';
import { FaSave, FaTimes, FaTrash } from 'react-icons/fa';

const EditTimeSlotModal = ({ timeSlot, onClose, onSave, onDelete }) => {
    const [startTime, setStartTime] = useState(timeSlot?.startTime || '');
    const [endTime, setEndTime] = useState(timeSlot?.endTime || '');
    const [day, setDay] = useState(timeSlot?.day || 'Monday');

    const handleSubmit = () => {
        const updatedTimeSlot = {
            timeSlotID: timeSlot.timeSlotID,
            startTime,
            endTime,
            day,
            observerID: Number(timeSlot.observerID)
        };

        onSave(updatedTimeSlot);
        onClose();
    };

    const handleDelete = () => {
        // Handle deleting the time slot
        if (timeSlot && timeSlot.timeSlotID) {
            console.log("Deleting timeSlot with ID:", timeSlot.timeSlotID);
            onDelete(timeSlot.timeSlotID);
        } else {
            console.error("timeSlotID is undefined. Cannot delete.");
        }
        onClose();
    };

    return (
        <div className="edit-time-slot-modal">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>
                    <FaTimes />
                </span>
                <h2>Edit Time Slot</h2>
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
                <div className="form-group">
                    <label htmlFor="day">Day:</label>
                    <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </select>
                </div>
                <div className="buttons">
                    <button type="button" className="save-button" onClick={handleSubmit}>
                        <FaSave /> Save
                    </button>
                    <button type="button" className="delete-button" onClick={handleDelete}>
                        <FaTrash /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTimeSlotModal;