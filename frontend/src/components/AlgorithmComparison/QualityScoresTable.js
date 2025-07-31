import React from 'react';

const QualityScoresTable = ({ comparison, getScoreColor }) => {
    // Check if we have three algorithms or just two
    const hasThreeAlgorithms = comparison['Linear Programming'];
    
    return (
        <div className="comparison-section">
            <h2>Quality Scores Comparison</h2>
            <table className="comparison-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Random Algorithm</th>
                        <th>Genetic Algorithm</th>
                        {hasThreeAlgorithms && <th>Linear Programming</th>}
                        <th>Winner</th>
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
                        {hasThreeAlgorithms && (
                            <td>
                                <span 
                                    className="score-badge" 
                                    style={{ backgroundColor: getScoreColor(comparison['Linear Programming'].overallScore) }}
                                >
                                    {comparison['Linear Programming'].overallScore}
                                </span>
                            </td>
                        )}
                        <td>
                            <span className="winner-badge">
                                {comparison.winner}
                            </span>
                        </td>
                    </tr>
                    {['coverage', 'workloadBalance', 'fairness', 'efficiency'].map((metric) => {
                        const randomValue = comparison['Random Algorithm'][metric];
                        const geneticValue = comparison['Genetic Algorithm'][metric];
                        const lpValue = hasThreeAlgorithms ? comparison['Linear Programming'][metric] : null;
                        
                        // Determine winner for this metric
                        let winner = 'Random Algorithm';
                        let bestValue = parseFloat(randomValue);
                        
                        if (parseFloat(geneticValue) > bestValue) {
                            winner = 'Genetic Algorithm';
                            bestValue = parseFloat(geneticValue);
                        }
                        
                        if (hasThreeAlgorithms && parseFloat(lpValue) > bestValue) {
                            winner = 'Linear Programming';
                            bestValue = parseFloat(lpValue);
                        }
                        
                        return (
                            <tr key={metric}>
                                <td>{metric.replace(/([A-Z])/g, ' $1').trim()}</td>
                                <td>{randomValue}</td>
                                <td>{geneticValue}</td>
                                {hasThreeAlgorithms && <td>{lpValue}</td>}
                                <td>
                                    <span className="winner-badge small">
                                        {winner}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            
            {hasThreeAlgorithms && comparison.improvements && (
                <div className="improvements-section">
                    <h3>Algorithm Improvements</h3>
                    <div className="improvements-grid">
                        <div className="improvement-card">
                            <h4>Genetic vs Random</h4>
                            <span className={parseFloat(comparison.improvements['Genetic vs Random']) > 0 ? 'positive' : 'negative'}>
                                {comparison.improvements['Genetic vs Random']}
                            </span>
                        </div>
                        <div className="improvement-card">
                            <h4>LP vs Random</h4>
                            <span className={parseFloat(comparison.improvements['LP vs Random']) > 0 ? 'positive' : 'negative'}>
                                {comparison.improvements['LP vs Random']}
                            </span>
                        </div>
                        <div className="improvement-card">
                            <h4>LP vs Genetic</h4>
                            <span className={parseFloat(comparison.improvements['LP vs Genetic']) > 0 ? 'positive' : 'negative'}>
                                {comparison.improvements['LP vs Genetic']}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityScoresTable; 