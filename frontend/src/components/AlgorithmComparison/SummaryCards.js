import React from 'react';

const SummaryCards = ({ comparison }) => {
    const randomOverall = comparison['Random Algorithm'].overallScore;
    const geneticOverall = comparison['Genetic Algorithm'].overallScore;
    const improvement = comparison.improvement.overallScore;

    return (
        <div className="summary-cards">
            <div className="summary-card">
                <h3>Random Algorithm</h3>
                <div className="card-value">{randomOverall}</div>
                <div className="card-subtitle">Overall Score</div>
            </div>
            
            <div className="summary-card">
                <h3>Genetic Algorithm</h3>
                <div className="card-value highlight">{geneticOverall}</div>
                <div className="card-subtitle">Overall Score</div>
            </div>
            
            <div className="summary-card">
                <h3>Improvement</h3>
                <div className={`card-value ${parseFloat(improvement) > 0 ? 'highlight' : 'small'}`}>
                    {improvement}
                </div>
                <div className="card-subtitle">Performance Gain</div>
            </div>
        </div>
    );
};

export default SummaryCards; 