import React from 'react';

const QualityScoresTable = ({ comparison, getScoreColor }) => {
    return (
        <div className="comparison-section">
            <h2>Quality Scores Comparison</h2>
            <table className="comparison-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Random Algorithm</th>
                        <th>Genetic Algorithm</th>
                        <th>Improvement</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            Overall Score
                            <span className="info-icon" title="Weighted average of all metrics">ⓘ</span>
                        </td>
                        <td>
                            <span 
                                className="score-badge" 
                                style={{ backgroundColor: getScoreColor(comparison['Random Algorithm'].overallScore) }}
                            >
                                {comparison['Random Algorithm'].overallScore}
                            </span>
                        </td>
                        <td>
                            <span 
                                className="score-badge" 
                                style={{ backgroundColor: getScoreColor(comparison['Genetic Algorithm'].overallScore) }}
                            >
                                {comparison['Genetic Algorithm'].overallScore}
                            </span>
                        </td>
                        <td>
                            <span className={parseFloat(comparison.improvement.overallScore) > 0 ? 'positive' : 'negative'}>
                                {comparison.improvement.overallScore}
                            </span>
                        </td>
                    </tr>
                    {['coverage', 'workloadBalance', 'fairness', 'efficiency'].map((metric) => (
                        <tr key={metric}>
                            <td>{metric.replace(/([A-Z])/g, ' $1').trim()}</td>
                            <td>{comparison['Random Algorithm'][metric]}</td>
                            <td>{comparison['Genetic Algorithm'][metric]}</td>
                            <td>
                                <span className={parseFloat(comparison.improvement[metric]) > 0 ? 'positive' : 'negative'}>
                                    {comparison.improvement[metric]}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default QualityScoresTable; 