import React from 'react';

const PerformanceTable = ({ comparison }) => {
    return (
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
    );
};

export default PerformanceTable; 