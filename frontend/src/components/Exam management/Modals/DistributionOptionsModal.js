import React from 'react';
import { 
    FaRandom, 
    FaDna, 
    FaTimes,
    FaChartLine 
} from 'react-icons/fa';
import './DistributionOptionsModal.scss';

const DistributionOptionsModal = ({ schedule, onClose, onSelectAlgorithm }) => {
    const distributionAlgorithms = [
        {
            id: 'random',
            name: 'Random Distribution',
            description: 'Randomly assign observers with basic constraints',
            icon: <FaRandom />,
            constraints: [
                'Head Observer: Must be Dr. with observer role',
                'Secretary: Any observer',
                'Ensures random but rule-based assignment'
            ]
        },
        {
            id: 'genetic',
            name: 'Genetic Algorithm Distribution',
            description: 'Optimize observer assignments using evolutionary techniques',
            icon: <FaDna />,
            constraints: [
                'Considers observer expertise and availability',
                'Minimizes conflicts and maximizes efficiency',
                'Iteratively improves assignment quality'
            ]
        },
        {
            id: 'compare',
            name: 'Compare & Apply Best',
            description: 'Run both algorithms, compare results, and apply the best one',
            icon: <FaChartLine />,
            constraints: [
                'Runs both Random and Genetic algorithms',
                'Compares quality metrics and performance',
                'Automatically applies the better result',
                'Shows detailed comparison report'
            ]
        }
    ];

    return (
        <div className="distribution-options-modal-overlay">
            <div className="distribution-options-modal">
                <div className="modal-header">
                    <h2>Distribution Algorithms</h2>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                
                <div className="modal-content">
                    <p className="schedule-info">
                        Schedule: {schedule.academicYear} - {schedule.semester} {schedule.examType}
                    </p>
                    <p className="schedule-exams-info">
                        Total Exams: {schedule.totalExams} | Unassigned: {schedule.totalExams - schedule.assignedExams}
                    </p>

                    <div className="distribution-algorithms">
                        {distributionAlgorithms.map((algorithm) => (
                            <div 
                                key={algorithm.id} 
                                className="algorithm-option"
                                onClick={() => onSelectAlgorithm(algorithm.id)}
                            >
                                <div className="algorithm-icon">{algorithm.icon}</div>
                                <div className="algorithm-details">
                                    <h3>{algorithm.name}</h3>
                                    <p>{algorithm.description}</p>
                                    <div className="algorithm-constraints">
                                        <strong>Constraints:</strong>
                                        <ul>
                                            {algorithm.constraints.map((constraint, index) => (
                                                <li key={index}>{constraint}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DistributionOptionsModal; 