import React from 'react';

const PerformanceTable = ({ comparison }) => {
    // Check if we have three algorithms or just two
    const hasThreeAlgorithms = comparison.performance['Linear Programming'];
    
    return (
        <div className="comparison-section">
            <h2>Performance Metrics</h2>
            <table className="comparison-table">
                <thead>
                    <tr>
                        <th>Algorithm</th>
                        <th>Time (ms)</th>
                        <th>Exams/Second</th>
                        <th>Speed Rank</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Random Algorithm</td>
                        <td>{comparison.performance['Random Algorithm'].totalTimeMs}</td>
                        <td>{comparison.performance['Random Algorithm'].examsPerSecond}</td>
                        <td>
                            <span className="rank-badge">
                                {hasThreeAlgorithms ? 
                                    (comparison.performance['Random Algorithm'].totalTimeMs <= comparison.performance['Genetic Algorithm'].totalTimeMs && 
                                     comparison.performance['Random Algorithm'].totalTimeMs <= comparison.performance['Linear Programming'].totalTimeMs ? '1st' : 
                                     comparison.performance['Random Algorithm'].totalTimeMs <= comparison.performance['Genetic Algorithm'].totalTimeMs || 
                                     comparison.performance['Random Algorithm'].totalTimeMs <= comparison.performance['Linear Programming'].totalTimeMs ? '2nd' : '3rd') : 
                                    (comparison.performance['Random Algorithm'].totalTimeMs <= comparison.performance['Genetic Algorithm'].totalTimeMs ? '1st' : '2nd')}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td>Genetic Algorithm</td>
                        <td>{comparison.performance['Genetic Algorithm'].totalTimeMs}</td>
                        <td>{comparison.performance['Genetic Algorithm'].examsPerSecond}</td>
                        <td>
                            <span className="rank-badge">
                                {hasThreeAlgorithms ? 
                                    (comparison.performance['Genetic Algorithm'].totalTimeMs <= comparison.performance['Random Algorithm'].totalTimeMs && 
                                     comparison.performance['Genetic Algorithm'].totalTimeMs <= comparison.performance['Linear Programming'].totalTimeMs ? '1st' : 
                                     comparison.performance['Genetic Algorithm'].totalTimeMs <= comparison.performance['Random Algorithm'].totalTimeMs || 
                                     comparison.performance['Genetic Algorithm'].totalTimeMs <= comparison.performance['Linear Programming'].totalTimeMs ? '2nd' : '3rd') : 
                                    (comparison.performance['Genetic Algorithm'].totalTimeMs <= comparison.performance['Random Algorithm'].totalTimeMs ? '1st' : '2nd')}
                            </span>
                        </td>
                    </tr>
                    {hasThreeAlgorithms && (
                        <tr>
                            <td>Linear Programming</td>
                            <td>{comparison.performance['Linear Programming'].totalTimeMs}</td>
                            <td>{comparison.performance['Linear Programming'].examsPerSecond}</td>
                            <td>
                                <span className="rank-badge">
                                    {comparison.performance['Linear Programming'].totalTimeMs <= comparison.performance['Random Algorithm'].totalTimeMs && 
                                     comparison.performance['Linear Programming'].totalTimeMs <= comparison.performance['Genetic Algorithm'].totalTimeMs ? '1st' : 
                                     comparison.performance['Linear Programming'].totalTimeMs <= comparison.performance['Random Algorithm'].totalTimeMs || 
                                     comparison.performance['Linear Programming'].totalTimeMs <= comparison.performance['Genetic Algorithm'].totalTimeMs ? '2nd' : '3rd'}
                                </span>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            
            {hasThreeAlgorithms && comparison.speedComparison && (
                <div className="speed-comparison-section">
                    <h3>Speed Comparisons</h3>
                    <div className="speed-comparisons-grid">
                        <div className="speed-card">
                            <h4>Genetic vs Random</h4>
                            <span className="speed-badge">
                                {comparison.speedComparison['Genetic vs Random']}
                            </span>
                        </div>
                        <div className="speed-card">
                            <h4>LP vs Random</h4>
                            <span className="speed-badge">
                                {comparison.speedComparison['LP vs Random']}
                            </span>
                        </div>
                        <div className="speed-card">
                            <h4>LP vs Genetic</h4>
                            <span className="speed-badge">
                                {comparison.speedComparison['LP vs Genetic']}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceTable; 