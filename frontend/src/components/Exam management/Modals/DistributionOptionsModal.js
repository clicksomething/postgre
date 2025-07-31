import React, { useState } from 'react';
import { 
    FaRandom, 
    FaDna, 
    FaTimes,
    FaChartLine,
    FaCog,
    FaArrowLeft,
    FaCalculator,
    FaPython
} from 'react-icons/fa';
import './DistributionOptionsModal.scss';

const DistributionOptionsModal = ({ schedule, onClose, onSelectAlgorithm }) => {
    const [showGeneticParams, setShowGeneticParams] = useState(false);
    const [geneticParams, setGeneticParams] = useState({
        populationSize: 200,
        generations: 100,
        mutationRate: 0.2,
        crossoverRate: 0.8,
        elitismRate: 0.15,
        useDeterministicInit: true
    });

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
            id: 'linear-programming',
            name: 'Linear Programming',
            description: 'Find optimal solution using JavaScript implementation',
            icon: <FaCalculator />,
            constraints: [
                'Guarantees optimal coverage (100% if feasible)',
                'Maximizes workload balance given coverage',
                'Maximizes fairness given coverage and workload',
                'Fast execution (seconds vs minutes)',
                'Pure JavaScript implementation - no external dependencies'
            ]
        },
        {
            id: 'compare',
            name: 'Compare & Apply Best',
            description: 'Run all three algorithms, compare results, and apply the best one',
            icon: <FaChartLine />,
            constraints: [
                'Runs Random, Genetic, and Linear Programming algorithms',
                'Compares quality metrics and performance across all three',
                'Automatically applies the best result',
                'Shows detailed three-way comparison report'
            ]
        }
    ];

    const handleGeneticAlgorithmSelect = () => {
        setShowGeneticParams(true);
    };

    const handleParameterChange = (param, value) => {
        setGeneticParams(prev => ({
            ...prev,
            [param]: value
        }));
    };

    const handleGeneticAlgorithmRun = () => {
        onSelectAlgorithm('genetic', geneticParams);
    };

    const handleAlgorithmSelect = (algorithmId) => {
        if (algorithmId === 'genetic') {
            handleGeneticAlgorithmSelect();
        } else {
            onSelectAlgorithm(algorithmId);
        }
    };

    const resetToDefaults = () => {
        setGeneticParams({
            populationSize: 200,
            generations: 100,
            mutationRate: 0.2,
            crossoverRate: 0.8,
            elitismRate: 0.15,
            useDeterministicInit: true
        });
    };

    if (showGeneticParams) {
        return (
            <div className="distribution-options-modal-overlay">
                <div className="distribution-options-modal genetic-params-modal">
                    <div className="modal-header">
                        <button className="back-btn" onClick={() => setShowGeneticParams(false)}>
                            <FaArrowLeft />
                        </button>
                        <h2>Genetic Algorithm Parameters</h2>
                        {/* Remove the close (X) button */}
                    </div>
                    
                    <p className="schedule-info">
                        Schedule: {schedule.academicYear} - {schedule.semester} {schedule.examType}
                    </p>
                    <p className="schedule-exams-info">
                        Total Exams: {schedule.totalExams} | Unassigned: {schedule.totalExams - schedule.assignedExams}
                    </p>

                    <h3 className="params-title">Algorithm Parameters</h3>
                    <p className="params-description">
                        Configure the genetic algorithm parameters to optimize performance for your dataset.
                    </p>

                    <div className="params-grid">
                            <div className="param-group">
                                <label htmlFor="populationSize">
                                    Population Size
                                    <span className="param-tooltip">Number of solutions in each generation (50-500)</span>
                                </label>
                                <input
                                    type="number"
                                    id="populationSize"
                                    value={geneticParams.populationSize}
                                    onChange={(e) => handleParameterChange('populationSize', parseInt(e.target.value))}
                                    min="50"
                                    max="500"
                                    step="10"
                                />
                                <small>Larger = more diversity, slower execution</small>
                            </div>

                            <div className="param-group">
                                <label htmlFor="generations">
                                    Generations
                                    <span className="param-tooltip">Number of evolution cycles (50-500)</span>
                                </label>
                                <input
                                    type="number"
                                    id="generations"
                                    value={geneticParams.generations}
                                    onChange={(e) => handleParameterChange('generations', parseInt(e.target.value))}
                                    min="50"
                                    max="500"
                                    step="10"
                                />
                                <small>More = better optimization, longer runtime</small>
                            </div>

                            <div className="param-group">
                                <label htmlFor="mutationRate">
                                    Mutation Rate
                                    <span className="param-tooltip">Probability of random changes (0.05-0.5)</span>
                                </label>
                                <input
                                    type="number"
                                    id="mutationRate"
                                    value={geneticParams.mutationRate}
                                    onChange={(e) => handleParameterChange('mutationRate', parseFloat(e.target.value))}
                                    min="0.05"
                                    max="0.5"
                                    step="0.05"
                                />
                                <small>Higher = more exploration, less stability</small>
                            </div>

                            <div className="param-group">
                                <label htmlFor="crossoverRate">
                                    Crossover Rate
                                    <span className="param-tooltip">Probability of combining solutions (0.5-0.9)</span>
                                </label>
                                <input
                                    type="number"
                                    id="crossoverRate"
                                    value={geneticParams.crossoverRate}
                                    onChange={(e) => handleParameterChange('crossoverRate', parseFloat(e.target.value))}
                                    min="0.5"
                                    max="0.9"
                                    step="0.05"
                                />
                                <small>Higher = more solution sharing</small>
                            </div>

                            <div className="param-group">
                                <label htmlFor="elitismRate">
                                    Elitism Rate
                                    <span className="param-tooltip">Percentage of best solutions to preserve (0.05-0.3)</span>
                                </label>
                                <input
                                    type="number"
                                    id="elitismRate"
                                    value={geneticParams.elitismRate}
                                    onChange={(e) => handleParameterChange('elitismRate', parseFloat(e.target.value))}
                                    min="0.05"
                                    max="0.3"
                                    step="0.05"
                                />
                                <small>Higher = preserves good solutions</small>
                            </div>

                            <div className="param-group checkbox-group">
                                <label htmlFor="useDeterministicInit">
                                    <input
                                        type="checkbox"
                                        id="useDeterministicInit"
                                        checked={geneticParams.useDeterministicInit}
                                        onChange={(e) => handleParameterChange('useDeterministicInit', e.target.checked)}
                                    />
                                    Use Smart Initialization
                                    <span className="param-tooltip">Start with high-quality solutions instead of random ones</span>
                                </label>
                                <small>Recommended for better initial population</small>
                            </div>
                        </div>

                    <div className="params-actions">
                        <button className="reset-btn" onClick={resetToDefaults}>
                            Reset to Defaults
                        </button>
                        <div className="run-actions">
                            <button className="cancel-btn" onClick={() => setShowGeneticParams(false)}>
                                Cancel
                            </button>
                            <button className="run-btn" onClick={handleGeneticAlgorithmRun}>
                                <FaDna /> Run Genetic Algorithm
                            </button>
                        </div>
                    </div>

                    <div className="params-info">
                        <h4>Parameter Guidelines:</h4>
                        <ul>
                            <li><strong>Small datasets</strong> (&lt;100 exams): Lower population (100-150), fewer generations (50-75)</li>
                            <li><strong>Medium datasets</strong> (100-500 exams): Default settings work well</li>
                            <li><strong>Large datasets</strong> (&gt;500 exams): Higher population (250-300), more generations (150-200)</li>
                            <li><strong>Mutation rate</strong>: Start with 0.2, increase if stuck in local optima</li>
                            <li><strong>Crossover rate</strong>: 0.8 is usually optimal</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="distribution-options-modal-overlay">
            <div className="distribution-options-modal">
                <div className="modal-header">
                    <h2>Distribution Algorithms</h2>
                    {/* Remove the close (X) button */}
                </div>
                
                    <p className="schedule-info">
                        Schedule: {schedule.academicYear} - {schedule.semester} {schedule.examType}
                    </p>
                    <p className="schedule-exams-info">
                        Total Exams: {schedule.totalExams} | Unassigned: {schedule.totalExams - schedule.assignedExams}
                    </p>

                        {distributionAlgorithms.map((algorithm) => (
                            <div 
                                key={algorithm.id} 
                                className="algorithm-option"
                        onClick={() => handleAlgorithmSelect(algorithm.id)}
                            >
                        {algorithm.icon}
                                    <h3>{algorithm.name}</h3>
                                    <p>{algorithm.description}</p>
                                        <strong>Constraints:</strong>
                                        <ul>
                                            {algorithm.constraints.map((constraint, index) => (
                                                <li key={index}>{constraint}</li>
                                            ))}
                                        </ul>
                            </div>
                        ))}
            </div>
        </div>
    );
};

export default DistributionOptionsModal; 