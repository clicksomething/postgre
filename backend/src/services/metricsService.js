const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');

class MetricsService {
    /**
     * Calculate and save metrics for any algorithm
     */
    static async saveMetrics(algorithmName, results, data, options = {}) {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                algorithm: algorithmName,
                examCount: data.exams.length,
                observerCount: data.observers.length,
                successfulAssignments: results.successful.length,
                failedAssignments: results.failed.length,
                performance: {
                    totalTimeMs: options.executionTime || 0,
                    examsPerSecond: options.executionTime ? 
                        (data.exams.length / (options.executionTime / 1000)).toFixed(2) : 0
                }
            };

            // Calculate quality metrics
            const assignments = results.successful.map(assignment => ({
                examId: assignment.examId,
                headId: assignment.headId,
                secretaryId: assignment.secretaryId
            }));

            metrics.qualityMetrics = AssignmentQualityMetrics.calculateMetrics(
                assignments,
                data.exams,
                data.observers
            );

            // Add algorithm-specific metrics
            if (algorithmName === 'genetic') {
                metrics.parameters = {
                    populationSize: options.populationSize,
                    generations: options.generations,
                    mutationRate: options.mutationRate,
                    crossoverRate: options.crossoverRate,
                    elitismRate: options.elitismRate
                };
                metrics.finalFitness = options.finalFitness;
                metrics.convergenceData = options.convergenceData;
            } else if (algorithmName === 'lp') {
                metrics.parameters = {
                    solver: options.solver,
                    timeLimit: options.timeLimit,
                    optimizationGoal: options.optimizationGoal
                };
                metrics.objectiveValue = options.objectiveValue;
            }

            // Save detailed results
            metrics.results = {
                successful: results.successful,
                failed: results.failed
            };

            // Save to file
            await this.saveMetricsToFile(algorithmName, metrics);

            // Update summary
            await this.updateSummary(metrics);

            return metrics;
        } catch (error) {
            console.error('Error saving metrics:', error);
            throw error;
        }
    }

    /**
     * Save metrics to appropriate file based on algorithm
     */
    static async saveMetricsToFile(algorithmName, metrics) {
        const reportsDir = path.join(__dirname, '../../performance-reports');
        const timestamp = metrics.timestamp.replace(/[:.]/g, '-');
        // Standardize algorithm names and file naming
        const getStandardizedName = (name) => {
            switch (name.toLowerCase()) {
                case 'random': return 'random';
                case 'genetic': return 'genetic';
                case 'lp':
                case 'linear_programming':
                case 'linear_programming_lexicographic':
                case 'linear programming':
                    return 'linear_programming';
                default: return name.toLowerCase();
            }
        };

        const standardizedName = getStandardizedName(algorithmName);
        
        // Use consistent file naming for each algorithm
        let filename;
        if (standardizedName === 'random') {
            filename = `assignment-performance-${timestamp}.json`;
        } else if (standardizedName === 'genetic') {
            filename = `ga-assignment-performance-${timestamp}.json`;
        } else if (standardizedName === 'linear_programming') {
            filename = `lp-assignment-performance-${timestamp}.json`;
        } else {
            filename = `${standardizedName}-assignment-performance-${timestamp}.json`;
        }
        const filepath = path.join(reportsDir, filename);

        // Ensure directory exists
        await fs.mkdir(reportsDir, { recursive: true });

        // Save metrics
        await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));
        console.log(`Metrics saved to ${filepath}`);
    }

    /**
     * Update performance summary file
     */
    static async updateSummary(metrics) {
        const summaryFile = path.join(__dirname, '../../performance-reports/performance-summary.jsonl');
        
        // Create summary entry
        const summary = {
            timestamp: metrics.timestamp,
            algorithm: metrics.algorithm,
            examCount: metrics.examCount,
            observerCount: metrics.observerCount,
            successRate: ((metrics.successfulAssignments / metrics.examCount) * 100).toFixed(1),
            qualityScore: metrics.qualityMetrics.overallScore.percentage.toFixed(1),
            examsPerSecond: metrics.performance.examsPerSecond
        };

        // Add algorithm-specific metrics
        if (metrics.algorithm === 'genetic') {
            summary.fitness = metrics.finalFitness;
            summary.generations = metrics.parameters.generations;
        }

        // Append to summary file with proper line ending
        const summaryLine = JSON.stringify(summary) + '\n\n';
        await fs.appendFile(summaryFile, summaryLine);
    }

    /**
     * Get latest metrics for an algorithm
     */
    static async getLatestMetrics(algorithmName) {
        const reportsDir = path.join(__dirname, '../../performance-reports');
        const files = await fs.readdir(reportsDir);
        
        // Filter and sort files for the specified algorithm
        const getPattern = (algo) => {
            switch (algo) {
                case 'random': return 'assignment-performance-';
                case 'genetic': return 'ga-assignment-performance-';
                case 'lp': return 'lp-assignment-performance-';
                default: return `${algo}-assignment-performance-`;
            }
        };
        
        const relevantFiles = files
            .filter(f => f.startsWith(getPattern(algorithmName)))
            .sort()
            .reverse();

        if (relevantFiles.length === 0) {
            return null;
        }

        // Read latest file
        const latestFile = path.join(reportsDir, relevantFiles[0]);
        const content = await fs.readFile(latestFile, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Compare metrics between algorithms
     */
    static async compareMetrics(algorithms = ['random', 'genetic', 'linear_programming']) {
        try {
            const comparison = {};
            let hasAnyMetrics = false;

            // Standardize algorithm names
            const getStandardizedName = (name) => {
                switch (name.toLowerCase()) {
                    case 'random': return 'random';
                    case 'genetic': return 'genetic';
                    case 'lp':
                    case 'linear_programming':
                    case 'linear_programming_lexicographic':
                    case 'linear programming':
                        return 'linear_programming';
                    default: return name.toLowerCase();
                }
            };

            const getDisplayName = (name) => {
                switch (name) {
                    case 'random': return 'Random Algorithm';
                    case 'genetic': return 'Genetic Algorithm';
                    case 'linear_programming': return 'Linear Programming';
                    default: return name.charAt(0).toUpperCase() + name.slice(1);
                }
            };

            // Get latest metrics for each algorithm
            for (const algo of algorithms) {
                const standardizedName = getStandardizedName(algo);
                const metrics = await this.getLatestMetrics(standardizedName);
                if (metrics && metrics.qualityMetrics && metrics.qualityMetrics.overallScore) {
                    hasAnyMetrics = true;
                    comparison[getDisplayName(standardizedName)] = {
                        overallScore: metrics.qualityMetrics.overallScore.percentage.toFixed(1) + '%',
                        coverage: metrics.qualityMetrics.coverage.percentage.toFixed(1) + '%',
                        workloadBalance: metrics.qualityMetrics.workloadBalance.score.toFixed(3),
                        fairness: metrics.qualityMetrics.fairness.score.toFixed(3),
                        efficiency: metrics.qualityMetrics.efficiency.percentage.toFixed(1) + '%',
                        grade: metrics.qualityMetrics.overallScore.grade,
                        performance: {
                            totalTimeMs: metrics.performance?.totalTimeMs || 0,
                            examsPerSecond: metrics.performance?.examsPerSecond || 0
                        }
                    };
                }
            }

            // If no metrics found at all, return null
            if (!hasAnyMetrics) {
                console.log('No metrics found for any algorithm');
                return null;
            }

            // Calculate improvements if we have multiple algorithms
            if (Object.keys(comparison).length > 1) {
                comparison.improvements = this.calculateImprovements(comparison);
            }

            return comparison;
        } catch (error) {
            console.error('Error in compareMetrics:', error);
            return null;
        }
    }

    /**
     * Calculate improvements between algorithms
     */
    static calculateImprovements(comparison) {
        const improvements = {};
        const algorithms = Object.keys(comparison);

        // Skip if we don't have at least 2 algorithms
        if (algorithms.length < 2) return improvements;

        // Calculate percentage improvements
        for (let i = 0; i < algorithms.length; i++) {
            for (let j = i + 1; j < algorithms.length; j++) {
                const algo1 = algorithms[i];
                const algo2 = algorithms[j];
                
                const score1 = parseFloat(comparison[algo1].overallScore.replace('%', '')) || 0;
                const score2 = parseFloat(comparison[algo2].overallScore.replace('%', '')) || 0;
                
                // Only calculate improvement if both scores are valid
                if (score1 > 0 && score2 > 0) {
                    improvements[`${algo2} vs ${algo1}`] = 
                        ((score2 - score1) / score1 * 100).toFixed(1) + '%';
                }
            }
        }

        return improvements;
    }

    /**
     * Get performance trends
     */
    static async getPerformanceTrends() {
        try {
            const summaryFile = path.join(__dirname, '../../performance-reports/performance-summary.jsonl');
            let content;
            
            try {
                content = await fs.readFile(summaryFile, 'utf8');
            } catch (readError) {
                console.error('Error reading summary file:', readError);
                return null;
            }
            
            // Split content into individual JSON objects
            const jsonStrings = content
                // First, replace all newlines with spaces to handle CRLF/LF consistently
                .replace(/\r?\n/g, ' ')
                // Then split on }{, which indicates adjacent JSON objects
                .split(/(?<=})\s*(?={)/)
                .map(str => str.trim())
                .filter(str => str.length > 0);
            
            console.log('Found', jsonStrings.length, 'potential summary entries');
            
            // Parse each JSON string carefully
            const summaries = [];
            for (const jsonStr of jsonStrings) {
                try {
                    // Clean up any remaining whitespace or newlines
                    const cleanJson = jsonStr.trim();
                    if (!cleanJson.startsWith('{') || !cleanJson.endsWith('}')) {
                        console.warn('Skipping invalid JSON:', cleanJson);
                        continue;
                    }
                    
                    const summary = JSON.parse(cleanJson);
                    
                    // Validate required fields
                    if (!summary.algorithm || !summary.timestamp) {
                        console.warn('Skipping summary missing required fields:', cleanJson);
                        continue;
                    }
                    
                    // Standardize algorithm name
                    summary.algorithm = getStandardizedName(summary.algorithm);
                    summaries.push(summary);
                } catch (parseError) {
                    console.error('Error parsing summary JSON:', parseError);
                    console.error('Problematic JSON:', jsonStr);
                    // Continue with other entries
                }
            }
            
            // Group by algorithm
            const byAlgorithm = {};
            summaries.forEach(summary => {
                if (!byAlgorithm[summary.algorithm]) {
                    byAlgorithm[summary.algorithm] = [];
                }
                byAlgorithm[summary.algorithm].push(summary);
            });
            
            // Calculate trends for each algorithm
            const trends = {};
            for (const [algo, data] of Object.entries(byAlgorithm)) {
                if (data.length > 0) {
                    trends[algo] = {
                        count: data.length,
                        avgSuccessRate: this.calculateAverage(data, 'successRate'),
                        avgQualityScore: this.calculateAverage(data, 'qualityScore'),
                        avgExamsPerSecond: this.calculateAverage(data, 'examsPerSecond')
                    };
                    
                    // Add algorithm-specific metrics
                    if (algo === 'genetic') {
                        trends[algo].avgFitness = this.calculateAverage(data, 'fitness');
                    }
                }
            }
            
            // Only return trends if we have data
            if (Object.keys(trends).length > 0) {
                console.log('Calculated trends:', trends);
                return trends;
            }
            
            console.log('No valid trend data found');
            return null;
        } catch (error) {
            console.error('Error getting performance trends:', error);
            return null;
        }
    }

    /**
     * Calculate average for a metric
     */
    static calculateAverage(items, field) {
        if (items.length === 0) return '0';
        const sum = items.reduce((acc, item) => acc + parseFloat(item[field] || 0), 0);
        return (sum / items.length).toFixed(1);
    }
}

module.exports = MetricsService;