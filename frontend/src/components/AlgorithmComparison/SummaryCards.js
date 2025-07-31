import React from 'react';

const SummaryCards = ({ comparison }) => {
    const randomOverall = comparison['Random Algorithm'].overallScore;
    const geneticOverall = comparison['Genetic Algorithm'].overallScore;
    const hasThreeAlgorithms = comparison['Linear Programming'];
    const lpOverall = hasThreeAlgorithms ? comparison['Linear Programming'].overallScore : null;
    
    // Determine the best score for highlighting
    const scores = [parseFloat(randomOverall), parseFloat(geneticOverall)];
    if (hasThreeAlgorithms) scores.push(parseFloat(lpOverall));
    const bestScore = Math.max(...scores);

    return (
        <div className="summary-cards">
            <div className="summary-card">
                <h3>Random Algorithm</h3>
                <div className={`card-value ${parseFloat(randomOverall) === bestScore ? 'highlight' : ''}`}>
                    {randomOverall}
                </div>
                <div className="card-subtitle">Overall Score</div>
                <div className="card-grade">{comparison['Random Algorithm'].grade}</div>
            </div>
            
            <div className="summary-card">
                <h3>Genetic Algorithm</h3>
                <div className={`card-value ${parseFloat(geneticOverall) === bestScore ? 'highlight' : ''}`}>
                    {geneticOverall}
                </div>
                <div className="card-subtitle">Overall Score</div>
                <div className="card-grade">{comparison['Genetic Algorithm'].grade}</div>
            </div>
            
            {hasThreeAlgorithms && (
                <div className="summary-card">
                    <h3>Linear Programming</h3>
                    <div className={`card-value ${parseFloat(lpOverall) === bestScore ? 'highlight' : ''}`}>
                        {lpOverall}
                    </div>
                    <div className="card-subtitle">Overall Score</div>
                    <div className="card-grade">{comparison['Linear Programming'].grade}</div>
                </div>
            )}
            
            <div className="summary-card winner">
                <h3>Winner</h3>
                <div className="card-value winner-value">
                    {comparison.winner}
                </div>
                <div className="card-subtitle">Best Algorithm</div>
                {comparison.summary && comparison.summary.recommendation && (
                    <div className="card-recommendation">
                        {comparison.summary.recommendation}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SummaryCards; 