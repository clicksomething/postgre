import React, { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useApi } from '../hooks/useApi';
import SummaryCards from './AlgorithmComparison/SummaryCards';
import QualityScoresTable from './AlgorithmComparison/QualityScoresTable';
import PerformanceTable from './AlgorithmComparison/PerformanceTable';
import TrendsSection from './AlgorithmComparison/TrendsSection';
import { getScoreColor } from './AlgorithmComparison/utils';
import './AlgorithmComparison.scss';

const AlgorithmComparison = () => {
    const [comparison, setComparison] = useState(null);
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const api = useApi();

    const fetchComparison = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get('/assignments/algorithms/compare');
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
            const data = await api.get('/assignments/algorithms/trends');
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

    if (loading) {
        return (
            <div className="comparison-page-wrapper">
                <div className="loading">Loading comparison data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="comparison-page-wrapper">
                <div className="error-message">
                    {error}
                    <button onClick={fetchComparison} className="retry-button">Retry</button>
                </div>
            </div>
        );
    }

    if (!comparison) {
        return (
            <div className="comparison-page-wrapper">
                <div className="info-message">
                    No comparison data available. Please run all three algorithms first.
                    <br /><br />
                    <strong>To generate comparison data:</strong>
                    <br />
                    1. Run the Random algorithm (Distribute button)
                    <br />
                    2. Run the Genetic algorithm (Genetic Algorithm button)
                    <br />
                    3. Run the Linear Programming algorithm (Linear Programming button)
                    <br />
                    4. Use "Compare & Apply Best" to run all three and compare results
                </div>
            </div>
        );
    }

    return (
        <div className="comparison-page-wrapper">
            <div className="comparison-header">
                <h1>Algorithm Comparison Report</h1>
                <button onClick={() => { fetchComparison(); fetchTrends(); }} className="refresh-button">
                    <FaSyncAlt /> Refresh
                </button>
            </div>

            <SummaryCards comparison={comparison} />
            <QualityScoresTable comparison={comparison} getScoreColor={getScoreColor} />
            <PerformanceTable comparison={comparison} />
            <TrendsSection trends={trends} />
        </div>
    );
};

export default AlgorithmComparison; 