/**
 * Compare Random vs Genetic Algorithm Assignment Quality
 */

const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('./assignmentQualityMetrics');

class AlgorithmComparison {
    /**
     * Load and compare the most recent reports from all algorithms
     */
    static async compareLatestReports() {
        try {
            const MetricsService = require('../services/metricsService');
            
            // Get comparison data from metrics service
            const metricsData = await MetricsService.compareMetrics();
            
            if (!metricsData || Object.keys(metricsData).length === 0) {
                console.log('No reports found to compare. Run algorithms first.');
                return null;
            }
            
            // Build a new comparison object with consistent structure
            const comparison = {};
            const scores = {};
            const performance = {};
            
            // Extract data from metrics, handling missing properties safely
            Object.entries(metricsData).forEach(([algo, data]) => {
                if (algo !== 'improvements' && algo !== 'summary') {
                    // Parse score, removing '%' if present
                    const scoreStr = (data.overallScore || '0%').replace('%', '');
                    scores[algo] = parseFloat(scoreStr) || 0;
                    
                    // Extract performance data safely
                    performance[algo] = {
                        totalTimeMs: data.performance?.totalTimeMs || 0,
                        examsPerSecond: data.performance?.examsPerSecond || 0
                    };
                    
                    // Build standardized comparison entry
                    comparison[algo] = {
                        overallScore: data.overallScore || '0%',
                        coverage: data.coverage || '0%',
                        workloadBalance: data.workloadBalance || '0',
                        fairness: data.fairness || '0',
                        efficiency: data.efficiency || '0%',
                        grade: data.grade || 'F',
                        performance: performance[algo]
                    };
                }
            });
            
            // If no valid algorithms found, return null
            if (Object.keys(comparison).length === 0) {
                console.log('No valid algorithm data found');
                return null;
            }
            
            // Add recommendation
            comparison.summary = {
                examCount: metricsData[Object.keys(metricsData)[0]]?.examCount || 0,
                observerCount: metricsData[Object.keys(metricsData)[0]]?.observerCount || 0,
                recommendation: this.getRecommendationForThreeWayComparison(scores, performance)
            };
            
            // Calculate speed comparisons only for algorithms with timing data
            const algorithms = Object.keys(performance)
                .filter(k => performance[k].totalTimeMs > 0);
            
            comparison.speedComparison = {};
            
            for (let i = 0; i < algorithms.length; i++) {
                for (let j = i + 1; j < algorithms.length; j++) {
                    const algo1 = algorithms[i];
                    const algo2 = algorithms[j];
                    const time1 = performance[algo1].totalTimeMs;
                    const time2 = performance[algo2].totalTimeMs;
                    
                    if (time1 > 0 && time2 > 0) {
                        comparison.speedComparison[`${algo2} vs ${algo1}`] = time2 < time1
                            ? `${(time1 / time2).toFixed(1)}x faster`
                            : `${(time2 / time1).toFixed(1)}x slower`;
                    }
                }
            }
            
            // Determine winner from valid scores
            const validScores = Object.entries(scores).filter(([_, score]) => score > 0);
            if (validScores.length > 0) {
                const winner = validScores.reduce((a, b) => a[1] > b[1] ? a : b)[0];
                comparison.winner = winner;
            }
            
            console.log('Comparison completed successfully');
            return comparison;
            
        } catch (error) {
            console.error('Error comparing reports:', error);
            return null;
        }
    }
    
    /**
     * Get recommendation based on comparison
     */
    static getRecommendation(comparison) {
        console.log('getRecommendation called with:', JSON.stringify(comparison, null, 2));
        
        // Check if comparison has the expected structure
        if (!comparison || !comparison['Random Algorithm'] || !comparison['Genetic Algorithm']) {
            console.error('Invalid comparison structure');
            return 'Unable to generate recommendation - invalid comparison data';
        }
        
        // Extract percentage values and convert to numbers
        const randomScore = parseFloat(comparison['Random Algorithm'].overallScore);
        const gaScore = parseFloat(comparison['Genetic Algorithm'].overallScore);
        
        // Extract speedup value (remove 'x slower' or 'x faster' suffix)
        const speedupStr = comparison.performance.speedup;
        const speedupValue = parseFloat(speedupStr);
        const isFaster = speedupStr.includes('faster');
        
        const scoreDiff = gaScore - randomScore;
        
        if (scoreDiff > 10) {
            return 'Use Genetic Algorithm - significantly better quality';
        } else if (scoreDiff > 5) {
            return 'Consider Genetic Algorithm - moderately better quality';
        } else if (scoreDiff < -10) {
            return 'Use Random Algorithm - significantly better quality';
        } else if (scoreDiff < -5) {
            return 'Consider Random Algorithm - moderately better quality';
        } else if (isFaster && speedupValue > 2) {
            return 'Use Genetic Algorithm - similar quality but faster';
        } else if (!isFaster && speedupValue > 2) {
            return 'Use Random Algorithm - similar quality but faster';
        } else {
            return 'Both algorithms perform similarly - choose based on your priorities';
        }
    }
    
    /**
     * Generate comparison report
     */
    static async generateComparisonReport() {
        const comparison = await this.compareLatestReports();
        
        if (!comparison) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `algorithm-comparison-${timestamp}.json`;
        const reportsDir = path.join(__dirname, '../../performance-reports');
        const filepath = path.join(reportsDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(comparison, null, 2));
        
        // Also print to console
        console.log('\n=== Algorithm Comparison Report ===\n');
        console.log('Quality Metrics:');
        console.table({
            'Overall Score': {
                Random: comparison['Random Algorithm'].overallScore,
                Genetic: comparison['Genetic Algorithm'].overallScore,
                Improvement: comparison.improvement.overallScore
            },
            'Coverage': {
                Random: comparison['Random Algorithm'].coverage,
                Genetic: comparison['Genetic Algorithm'].coverage,
                Improvement: comparison.improvement.coverage
            },
            'Workload Balance': {
                Random: comparison['Random Algorithm'].workloadBalance,
                Genetic: comparison['Genetic Algorithm'].workloadBalance,
                Improvement: comparison.improvement.workloadBalance
            },
            'Fairness': {
                Random: comparison['Random Algorithm'].fairness,
                Genetic: comparison['Genetic Algorithm'].fairness,
                Improvement: comparison.improvement.fairness
            },
            'Efficiency': {
                Random: comparison['Random Algorithm'].efficiency,
                Genetic: comparison['Genetic Algorithm'].efficiency,
                Improvement: comparison.improvement.efficiency
            }
        });
        
        console.log('\nPerformance Metrics:');
        console.table(comparison.performance);
        
        console.log('\nRecommendation:', comparison.summary.recommendation);
        console.log('\nComparison report saved to:', filepath);
        
        return comparison;
    }
    
    /**
     * Analyze performance-summary.jsonl file
     */
    static async analyzeSummaryTrends() {
        try {
            const MetricsService = require('../services/metricsService');
            const trends = await MetricsService.getPerformanceTrends();
            
            if (!trends) {
                console.log('No trend data available. Run algorithms first.');
                return null;
            }
            
            console.log('\n=== Algorithm Performance Trends ===\n');
            console.table(trends);
            
            return trends;
        } catch (error) {
            console.error('Error analyzing trends:', error);
            return null;
        }
    }

    // Compare results directly (without reading from files)
    static async compareResults(randomData, geneticData, exams, observers) {
        try {
            // Extract metrics from results
            const randomMetrics = this.extractMetrics(randomData.result);
            const geneticMetrics = this.extractMetrics(geneticData.result);

            // Prepare assignments arrays for quality metrics calculation
            const randomAssignments = randomMetrics.assignments.map(a => {
                const headObserver = observers.find(o => o.name === a.head);
                const secretaryObserver = observers.find(o => o.name === a.secretary);
                return {
                    examId: a.examId,
                    headId: headObserver?.observerid || null,
                    secretaryId: secretaryObserver?.observerid || null
                };
            });

            const geneticAssignments = geneticMetrics.assignments.map(a => {
                const headObserver = observers.find(o => o.name === a.head);
                const secretaryObserver = observers.find(o => o.name === a.secretary);
                return {
                    examId: a.examId,
                    headId: headObserver?.observerid || null,
                    secretaryId: secretaryObserver?.observerid || null
                };
            });

            // Calculate REAL quality metrics
            const randomQualityMetrics = AssignmentQualityMetrics.calculateMetrics(
                randomAssignments,
                exams,
                observers
            );
            
            const geneticQualityMetrics = AssignmentQualityMetrics.calculateMetrics(
                geneticAssignments,
                exams,
                observers
            );

            // Use AssignmentQualityMetrics.compareResults
            const comparison = AssignmentQualityMetrics.compareResults(
                randomQualityMetrics,
                geneticQualityMetrics,
                'Random Algorithm',
                'Genetic Algorithm'
            );

            // Performance comparison
            const randomExamsPerSec = randomMetrics.totalExams / (randomData.executionTime / 1000);
            const geneticExamsPerSec = geneticMetrics.totalExams / (geneticData.executionTime / 1000);
            const speedup = geneticExamsPerSec > randomExamsPerSec 
                ? `${(geneticExamsPerSec / randomExamsPerSec).toFixed(1)}x faster`
                : `${(randomExamsPerSec / geneticExamsPerSec).toFixed(1)}x slower`;

            // Add performance data to comparison
            comparison.performance = {
                'Random Algorithm': {
                    totalTimeMs: randomData.executionTime,
                    examsPerSecond: randomExamsPerSec.toFixed(2)
                },
                'Genetic Algorithm': {
                    totalTimeMs: geneticData.executionTime,
                    examsPerSecond: geneticExamsPerSec.toFixed(2)
                },
                speedup
            };
            
            comparison.summary = {
                examCount: randomMetrics.totalExams,
                observerCount: randomMetrics.observersUsed,
                recommendation: this.getRecommendationForDirectComparison(randomQualityMetrics, geneticQualityMetrics, speedup)
            };

            return comparison;
        } catch (error) {
            console.error('Error comparing results:', error);
            throw error;
        }
    }

    static extractAlgorithmMetrics(report) {
        // Extract common metrics
        const metrics = {
            overallScore: '0%',
            coverage: '0%',
            workloadBalance: '0',
            fairness: '0',
            efficiency: '0%',
            grade: 'F',
            totalTimeMs: 0,
            examsPerSecond: 0
        };

        // Extract quality metrics if available
        if (report.qualityMetrics) {
            metrics.overallScore = report.qualityMetrics.overallScore?.percentage?.toFixed(1) + '%' || '0%';
            metrics.coverage = report.qualityMetrics.coverage?.percentage?.toFixed(1) + '%' || '0%';
            metrics.workloadBalance = report.qualityMetrics.workloadBalance?.score?.toFixed(3) || '0';
            metrics.fairness = report.qualityMetrics.fairness?.score?.toFixed(3) || '0';
            metrics.efficiency = report.qualityMetrics.efficiency?.percentage?.toFixed(1) + '%' || '0%';
            metrics.grade = report.qualityMetrics.overallScore?.grade || 'F';
        }

        // Extract performance metrics based on algorithm type
        if (report.performance) {
            // Random algorithm structure
            metrics.totalTimeMs = report.performance.totalTimeMs || 0;
            metrics.examsPerSecond = report.performance.examsPerSecond || 0;
        } else {
            // GA/LP structure
            metrics.totalTimeMs = report.totalTimeMs || 0;
            metrics.examsPerSecond = report.examsPerSecond || 0;
        }

        return metrics;
    }

    static extractMetrics(result) {
        // Handle different result structures
        if (result.results) {
            // Random algorithm structure
            return {
                totalExams: result.results.successful.length + result.results.failed.length,
                successfulAssignments: result.results.successful.length,
                failedAssignments: result.results.failed.length,
                observersUsed: new Set(
                    result.results.successful.flatMap(s => [s.head, s.secretary])
                ).size,
                assignments: result.results.successful,
                observerWorkloads: {}
            };
        } else if (result.successful && result.failed) {
            // Genetic algorithm structure
            return {
                totalExams: result.successful.length + result.failed.length,
                successfulAssignments: result.successful.length,
                failedAssignments: result.failed.length,
                observersUsed: new Set(
                    result.successful.flatMap(s => [s.head, s.secretary])
                ).size,
                assignments: result.successful,
                observerWorkloads: {}
            };
        } else {
            throw new Error('Unknown result structure');
        }
    }

    static getGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    static getRecommendationForDirectComparison(randomQuality, geneticQuality, speedup) {
        const qualityDiff = (geneticQuality.overallScore.score - randomQuality.overallScore.score) * 100;
        
        if (qualityDiff > 10) {
            return "Use Genetic Algorithm for significantly better quality";
        } else if (qualityDiff > 5) {
            return "Use Genetic Algorithm for better quality";
        } else if (qualityDiff < -10) {
            return "Use Random Algorithm for better quality";
        } else if (speedup.includes('faster') && parseFloat(speedup) > 2) {
            return "Use Genetic Algorithm for better performance";
        } else {
            return "Both algorithms perform similarly";
        }
    }

    static getRecommendationForThreeWayComparison(scores, performance) {
        try {
            // Get available algorithms (only those with both score and performance data)
            const availableAlgos = Object.keys(scores).filter(algo => 
                scores[algo] > 0 && performance[algo]?.totalTimeMs > 0
            );

            // Basic availability checks
            if (availableAlgos.length === 0) return "No data available for comparison";
            if (availableAlgos.length === 1) return `Only ${availableAlgos[0]} has data available`;

            // Create a map of available algorithms with their metrics
            const algoMetrics = {};
            availableAlgos.forEach(algo => {
                algoMetrics[algo] = {
                    score: scores[algo] || 0,
                    time: performance[algo]?.totalTimeMs || 0
                };
            });

            // Find best quality and fastest
            let bestQuality = { algo: null, score: 0 };
            let fastest = { algo: null, time: Infinity };

            Object.entries(algoMetrics).forEach(([algo, metrics]) => {
                if (metrics.score > bestQuality.score) {
                    bestQuality = { algo, score: metrics.score };
                }
                if (metrics.time < fastest.time) {
                    fastest = { algo, time: metrics.time };
                }
            });

            // Generate pairwise comparisons
            const recommendations = [];
            for (let i = 0; i < availableAlgos.length; i++) {
                for (let j = i + 1; j < availableAlgos.length; j++) {
                    const algo1 = availableAlgos[i];
                    const algo2 = availableAlgos[j];
                    
                    const scoreDiff = algoMetrics[algo2].score - algoMetrics[algo1].score;
                    const timeDiff = algoMetrics[algo1].time - algoMetrics[algo2].time;
                    
                    // Only add significant differences
                    if (Math.abs(scoreDiff) > 5) {
                        recommendations.push(`${scoreDiff > 0 ? algo2 : algo1} shows better quality than ${scoreDiff > 0 ? algo1 : algo2}`);
                    }
                    if (Math.abs(timeDiff) > algoMetrics[algo1].time * 0.2) {
                        recommendations.push(`${timeDiff > 0 ? algo2 : algo1} is significantly faster than ${timeDiff > 0 ? algo1 : algo2}`);
                    }
                }
            }

            // Return recommendations
            if (recommendations.length > 0) {
                return recommendations.join(". ") + ".";
            }

            // Default recommendation
            if (bestQuality.algo === fastest.algo) {
                return `${bestQuality.algo} shows the best overall performance`;
            } else {
                return `${bestQuality.algo} shows best quality, while ${fastest.algo} is fastest`;
            }
        } catch (error) {
            console.error('Error generating recommendation:', error);
            return "Unable to generate recommendation due to insufficient data";
        }
    }
    }

// If run directly
if (require.main === module) {
    AlgorithmComparison.generateComparisonReport()
        .then(() => AlgorithmComparison.analyzeSummaryTrends())
        .catch(console.error);
}

module.exports = AlgorithmComparison; 