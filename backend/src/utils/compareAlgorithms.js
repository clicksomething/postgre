/**
 * Compare Random vs Genetic Algorithm Assignment Quality
 */

const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('./assignmentQualityMetrics');

class AlgorithmComparison {
    /**
     * Load and compare the most recent reports from both algorithms
     */
    static async compareLatestReports() {
        try {
            const reportsDir = path.join(__dirname, '../../performance-reports');
            console.log('Looking for reports in:', reportsDir);
            
            const files = await fs.readdir(reportsDir);
            console.log('All files found:', files.length);
            
            // Find latest reports for each algorithm
            const randomReports = files.filter(f => f.startsWith('assignment-performance-'));
            const gaReports = files.filter(f => f.startsWith('ga-assignment-performance-'));
            
            console.log('Random reports found:', randomReports.length);
            console.log('GA reports found:', gaReports.length);
            
            if (randomReports.length === 0 || gaReports.length === 0) {
                console.log('Not enough reports to compare. Run both algorithms first.');
                return null;
            }
            
            // Sort by timestamp (newest first)
            randomReports.sort().reverse();
            gaReports.sort().reverse();
            
            // Load latest reports
            const randomReport = JSON.parse(
                await fs.readFile(path.join(reportsDir, randomReports[0]), 'utf8')
            );
            const gaReport = JSON.parse(
                await fs.readFile(path.join(reportsDir, gaReports[0]), 'utf8')
            );
            
            console.log('Random report keys:', Object.keys(randomReport));
            console.log('GA report keys:', Object.keys(gaReport));
            console.log('Random qualityMetrics exists:', !!randomReport.qualityMetrics);
            console.log('GA qualityMetrics exists:', !!gaReport.qualityMetrics);
            
            // Check if reports have qualityMetrics
            if (!randomReport.qualityMetrics || !gaReport.qualityMetrics) {
                console.log('\n⚠️  One or both reports lack qualityMetrics. These may be old reports.');
                console.log('Please run both algorithms again to generate new reports with quality metrics.');
                console.log('\nTo regenerate reports:');
                console.log('1. Click "Distribute" to run the Random algorithm');
                console.log('2. Click "Compare Algorithms" and wait for both algorithms to complete');
                return null;
            }
            
            // Compare quality metrics
            const comparison = AssignmentQualityMetrics.compareResults(
                randomReport.qualityMetrics,
                gaReport.qualityMetrics,
                'Random Algorithm',
                'Genetic Algorithm'
            );
            
            console.log('Comparison object from AssignmentQualityMetrics:', JSON.stringify(comparison, null, 2));
            
            if (!comparison) {
                console.error('AssignmentQualityMetrics.compareResults returned null/undefined');
                return null;
            }
            
            // Add performance comparison
            comparison.performance = {
                'Random Algorithm': {
                    totalTimeMs: randomReport.performance.totalTimeMs,
                    examsPerSecond: randomReport.performance.examsPerSecond
                },
                'Genetic Algorithm': {
                    totalTimeMs: gaReport.totalTimeMs,
                    examsPerSecond: gaReport.examsPerSecond
                },
                speedup: (randomReport.performance.totalTimeMs / gaReport.totalTimeMs).toFixed(2) + 'x slower'
            };
            
            console.log('Comparison object after adding performance:', JSON.stringify(comparison, null, 2));
            
            // Add summary
            comparison.summary = {
                examCount: randomReport.examCount,
                observerCount: randomReport.observerCount,
                recommendation: this.getRecommendation(comparison)
            };
            
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
            const summaryFile = path.join(__dirname, '../../performance-reports/performance-summary.jsonl');
            const content = await fs.readFile(summaryFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line);
            
            const summaries = lines.map(line => JSON.parse(line));
            
            // Group by algorithm
            const randomSummaries = summaries.filter(s => s.algorithm === 'random');
            const gaSummaries = summaries.filter(s => s.algorithm === 'genetic');
            
            // Calculate averages
            const calculateAverage = (items, field) => {
                if (items.length === 0) return 0;
                return items.reduce((sum, item) => sum + parseFloat(item[field] || 0), 0) / items.length;
            };
            
            const trends = {
                random: {
                    count: randomSummaries.length,
                    avgSuccessRate: calculateAverage(randomSummaries, 'successRate').toFixed(1),
                    avgQualityScore: calculateAverage(randomSummaries, 'qualityScore').toFixed(1),
                    avgExamsPerSecond: calculateAverage(randomSummaries, 'examsPerSecond').toFixed(1)
                },
                genetic: {
                    count: gaSummaries.length,
                    avgSuccessRate: calculateAverage(gaSummaries, 'successRate').toFixed(1),
                    avgQualityScore: calculateAverage(gaSummaries, 'qualityScore').toFixed(1),
                    avgExamsPerSecond: calculateAverage(gaSummaries, 'examsPerSecond').toFixed(1),
                    avgFitness: calculateAverage(gaSummaries, 'fitness').toFixed(3)
                }
            };
            
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
}

// If run directly
if (require.main === module) {
    AlgorithmComparison.generateComparisonReport()
        .then(() => AlgorithmComparison.analyzeSummaryTrends())
        .catch(console.error);
}

module.exports = AlgorithmComparison; 