import React, { useState, useEffect } from 'react';
import './AlgorithmComparison.scss';

const AlgorithmComparison = () => {
    const [comparison, setComparison] = useState(null);
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchComparison = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('http://localhost:3000/api/assignments/algorithms/compare', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            if (data.success) {
                setComparison(data.comparison);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Failed to fetch comparison data');
        } finally {
            setLoading(false);
        }
    };

    const fetchTrends = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('http://localhost:3000/api/assignments/algorithms/trends', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            if (data.success) {
                setTrends(data.trends);
            }
        } catch (err) {
            console.error('Failed to fetch trends:', err);
        }
    };

    useEffect(() => {
        // Check if there's a comparison in localStorage (from the compare operation)
        const storedComparison = localStorage.getItem('latestComparison');
        if (storedComparison) {
            try {
                const parsedComparison = JSON.parse(storedComparison);
                setComparison(parsedComparison);
                // Clear it from localStorage after reading
                localStorage.removeItem('latestComparison');
            } catch (err) {
                console.error('Error parsing stored comparison:', err);
            }
        } else {
            // Otherwise fetch from the API
            fetchComparison();
        }
        fetchTrends();
    }, []);

    const getScoreColor = (score) => {
        const value = parseFloat(score);
        if (value >= 90) return '#4caf50';
        if (value >= 80) return '#8bc34a';
        if (value >= 70) return '#ff9800';
        if (value >= 60) return '#ff5722';
        return '#f44336';
    };

    if (loading) {
        return (
            <div className="comparison-container">
                <div className="loading">Loading comparison data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="comparison-container">
                <div className="error-message">
                    {error}
                    <button onClick={fetchComparison} className="retry-button">Retry</button>
                </div>
            </div>
        );
    }

    if (!comparison) {
        return (
            <div className="comparison-container">
                <div className="info-message">
                    No comparison data available. Please run both algorithms first.
                </div>
            </div>
        );
    }

    return (
        <div className="comparison-container">
            <div className="comparison-header">
                <h1>Algorithm Comparison Report</h1>
                <button onClick={() => { fetchComparison(); fetchTrends(); }} className="refresh-button">
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card">
                    <h3>Winner</h3>
                    <div className="card-value">{comparison.winner}</div>
                    <div className="card-subtitle">Based on overall quality score</div>
                </div>
                <div className="summary-card">
                    <h3>Speed Difference</h3>
                    <div className="card-value highlight">{comparison.performance.speedup}</div>
                    <div className="card-subtitle">Genetic Algorithm vs Random</div>
                </div>
                <div className="summary-card">
                    <h3>Recommendation</h3>
                    <div className="card-value small">{comparison.summary.recommendation}</div>
                </div>
            </div>

            {/* Quality Scores Comparison */}
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

            {/* Performance Comparison */}
            <div className="comparison-section">
                <h2>Performance Metrics</h2>
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Algorithm</th>
                            <th>Time (ms)</th>
                            <th>Exams/Second</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Random Algorithm</td>
                            <td>{comparison.performance['Random Algorithm'].totalTimeMs}</td>
                            <td>{comparison.performance['Random Algorithm'].examsPerSecond}</td>
                        </tr>
                        <tr>
                            <td>Genetic Algorithm</td>
                            <td>{comparison.performance['Genetic Algorithm'].totalTimeMs}</td>
                            <td>{comparison.performance['Genetic Algorithm'].examsPerSecond}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Historical Trends */}
            {trends && (
                <div className="comparison-section">
                    <h2>Historical Performance Trends</h2>
                    <div className="trends-grid">
                        <div className="trend-box">
                            <h3>Random Algorithm ({trends.random.count} runs)</h3>
                            <div className="trend-stat">
                                <span className="label">Average Success Rate:</span>
                                <span className="value">{trends.random.avgSuccessRate}%</span>
                            </div>
                            <div className="trend-stat">
                                <span className="label">Average Quality Score:</span>
                                <span className="value">{trends.random.avgQualityScore}%</span>
                            </div>
                            <div className="trend-stat">
                                <span className="label">Average Speed:</span>
                                <span className="value">{trends.random.avgExamsPerSecond} exams/sec</span>
                            </div>
                        </div>
                        <div className="trend-box">
                            <h3>Genetic Algorithm ({trends.genetic.count} runs)</h3>
                            <div className="trend-stat">
                                <span className="label">Average Success Rate:</span>
                                <span className="value">{trends.genetic.avgSuccessRate}%</span>
                            </div>
                            <div className="trend-stat">
                                <span className="label">Average Quality Score:</span>
                                <span className="value">{trends.genetic.avgQualityScore}%</span>
                            </div>
                            <div className="trend-stat">
                                <span className="label">Average Speed:</span>
                                <span className="value">{trends.genetic.avgExamsPerSecond} exams/sec</span>
                            </div>
                            <div className="trend-stat">
                                <span className="label">Average Fitness:</span>
                                <span className="value">{trends.genetic.avgFitness}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlgorithmComparison; 