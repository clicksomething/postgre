import React from 'react';

const TrendsSection = ({ trends }) => {
    if (!trends) return null;

    return (
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
                </div>
            </div>
        </div>
    );
};

export default TrendsSection; 