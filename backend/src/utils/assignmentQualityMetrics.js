/**
 * Assignment Quality Metrics Calculator
 * Calculates various quality metrics for exam-observer assignments
 */

class AssignmentQualityMetrics {
    /**
     * Calculate all quality metrics for an assignment result
     * @param {Array} assignments - Array of assignment objects with examId, headId, secretaryId
     * @param {Array} exams - Array of exam objects
     * @param {Array} observers - Array of observer objects
     * @returns {Object} Quality metrics
     */
    static calculateMetrics(assignments, exams, observers) {
        const metrics = {
            coverage: this.calculateCoverage(assignments),
            workloadBalance: this.calculateWorkloadBalance(assignments, observers),
            efficiency: this.calculateEfficiency(assignments, exams),
            fairness: this.calculateFairness(assignments, observers),
            observerUtilization: this.calculateObserverUtilization(assignments, observers),
            summary: {}
        };

        // Calculate overall quality score (weighted average)
        metrics.overallScore = this.calculateOverallScore(metrics);
        
        // Add summary
        metrics.summary = {
            totalExams: exams.length,
            assignedExams: assignments.filter(a => a.headId && a.secretaryId).length,
            unassignedExams: assignments.filter(a => !a.headId || !a.secretaryId).length,
            totalObservers: observers.length,
            activeObservers: metrics.observerUtilization.activeObservers,
            averageWorkload: metrics.workloadBalance.averageWorkload,
            workloadStandardDeviation: metrics.workloadBalance.standardDeviation
        };

        return metrics;
    }

    /**
     * Calculate assignment coverage (percentage of exams assigned)
     */
    static calculateCoverage(assignments) {
        const total = assignments.length;
        const assigned = assignments.filter(a => a.headId && a.secretaryId).length;
        
        return {
            assignedCount: assigned,
            totalCount: total,
            percentage: total > 0 ? (assigned / total) * 100 : 0,
            score: total > 0 ? assigned / total : 0
        };
    }

    /**
     * Calculate workload balance among observers
     */
    static calculateWorkloadBalance(assignments, observers) {
        const workloadMap = new Map();
        
        // Initialize all observers with 0 workload
        observers.forEach(obs => workloadMap.set(obs.observerid, 0));
        
        // Count assignments per observer
        assignments.forEach(assignment => {
            if (assignment.headId) {
                workloadMap.set(assignment.headId, (workloadMap.get(assignment.headId) || 0) + 1);
            }
            if (assignment.secretaryId) {
                workloadMap.set(assignment.secretaryId, (workloadMap.get(assignment.secretaryId) || 0) + 1);
            }
        });

        const workloads = Array.from(workloadMap.values()).filter(w => w > 0);
        const totalWorkload = workloads.reduce((sum, w) => sum + w, 0);
        const avgWorkload = workloads.length > 0 ? totalWorkload / workloads.length : 0;
        
        // Calculate standard deviation
        const variance = workloads.length > 0 
            ? workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length 
            : 0;
        const stdDev = Math.sqrt(variance);
        
        // Calculate coefficient of variation (normalized measure)
        const coefficientOfVariation = avgWorkload > 0 ? stdDev / avgWorkload : 0;
        
        // Score: inverse of coefficient of variation (lower variation = higher score)
        const score = 1 / (1 + coefficientOfVariation);

        return {
            workloadDistribution: Object.fromEntries(workloadMap),
            averageWorkload: avgWorkload,
            standardDeviation: stdDev,
            coefficientOfVariation: coefficientOfVariation,
            minWorkload: Math.min(...workloads),
            maxWorkload: Math.max(...workloads),
            score: score
        };
    }

    /**
     * Calculate efficiency (observer continuity for consecutive exams)
     */
    static calculateEfficiency(assignments, exams) {
        let continuityCount = 0;
        let possibleContinuities = 0;

        // Sort assignments by exam date and time
        const sortedAssignments = assignments
            .map((a, idx) => ({ ...a, exam: exams[idx] }))
            .sort((a, b) => {
                const dateCompare = new Date(a.exam.examdate) - new Date(b.exam.examdate);
                if (dateCompare !== 0) return dateCompare;
                return a.exam.starttime.localeCompare(b.exam.starttime);
            });

        // Check consecutive exams
        for (let i = 1; i < sortedAssignments.length; i++) {
            const prev = sortedAssignments[i - 1];
            const curr = sortedAssignments[i];

            // Check if exams are consecutive (same day, end time = start time)
            if (prev.exam.examdate === curr.exam.examdate && 
                prev.exam.endtime === curr.exam.starttime) {
                possibleContinuities++;

                // Check if any observer continues
                if ((prev.headId && (prev.headId === curr.headId || prev.headId === curr.secretaryId)) ||
                    (prev.secretaryId && (prev.secretaryId === curr.headId || prev.secretaryId === curr.secretaryId))) {
                    continuityCount++;
                }
            }
        }

        const score = possibleContinuities > 0 ? continuityCount / possibleContinuities : 1;

        return {
            continuityCount: continuityCount,
            possibleContinuities: possibleContinuities,
            percentage: possibleContinuities > 0 ? (continuityCount / possibleContinuities) * 100 : 100,
            score: score
        };
    }

    /**
     * Calculate fairness using Gini coefficient
     */
    static calculateFairness(assignments, observers) {
        const workloadMap = new Map();
        
        // Count assignments per observer
        observers.forEach(obs => workloadMap.set(obs.observerid, 0));
        
        assignments.forEach(assignment => {
            if (assignment.headId) {
                workloadMap.set(assignment.headId, (workloadMap.get(assignment.headId) || 0) + 1);
            }
            if (assignment.secretaryId) {
                workloadMap.set(assignment.secretaryId, (workloadMap.get(assignment.secretaryId) || 0) + 1);
            }
        });

        // Calculate Gini coefficient
        const workloads = Array.from(workloadMap.values()).sort((a, b) => a - b);
        const n = workloads.length;
        
        if (n === 0 || workloads.every(w => w === 0)) {
            return { giniCoefficient: 0, score: 1 };
        }

        let sumOfDifferences = 0;
        let sumOfValues = 0;

        for (let i = 0; i < n; i++) {
            sumOfValues += workloads[i];
            sumOfDifferences += (2 * (i + 1) - n - 1) * workloads[i];
        }

        const gini = sumOfValues > 0 ? sumOfDifferences / (n * sumOfValues) : 0;
        
        // Score: inverse of Gini (lower Gini = higher fairness)
        const score = 1 - Math.abs(gini);

        return {
            giniCoefficient: gini,
            interpretation: gini < 0.2 ? 'Very Fair' : gini < 0.4 ? 'Fair' : gini < 0.6 ? 'Moderate' : 'Unfair',
            score: score
        };
    }

    /**
     * Calculate observer utilization
     */
    static calculateObserverUtilization(assignments, observers) {
        const activeObservers = new Set();
        
        assignments.forEach(assignment => {
            if (assignment.headId) activeObservers.add(assignment.headId);
            if (assignment.secretaryId) activeObservers.add(assignment.secretaryId);
        });

        const utilizationRate = observers.length > 0 ? activeObservers.size / observers.length : 0;

        return {
            totalObservers: observers.length,
            activeObservers: activeObservers.size,
            inactiveObservers: observers.length - activeObservers.size,
            utilizationPercentage: utilizationRate * 100,
            score: utilizationRate
        };
    }

    /**
     * Calculate overall quality score
     */
    static calculateOverallScore(metrics) {
        const weights = {
            coverage: 0.4,      // 40% - Most important
            workloadBalance: 0.3, // 30% - Very important
            fairness: 0.2,      // 20% - Important
            efficiency: 0.1     // 10% - Nice to have
        };

        const weightedScore = 
            weights.coverage * metrics.coverage.score +
            weights.workloadBalance * metrics.workloadBalance.score +
            weights.fairness * metrics.fairness.score +
            weights.efficiency * metrics.efficiency.score;

        return {
            score: weightedScore,
            percentage: weightedScore * 100,
            grade: this.getGrade(weightedScore),
            weights: weights
        };
    }

    /**
     * Get letter grade for score
     */
    static getGrade(score) {
        if (score >= 0.9) return 'A';
        if (score >= 0.8) return 'B';
        if (score >= 0.7) return 'C';
        if (score >= 0.6) return 'D';
        return 'F';
    }

    /**
     * Compare two assignment results
     */
    static compareResults(result1, result2, label1 = 'Result 1', label2 = 'Result 2') {
        const metrics1 = result1.metrics || result1;
        const metrics2 = result2.metrics || result2;

        const comparison = {
            [label1]: {
                overallScore: metrics1.overallScore.percentage.toFixed(1) + '%',
                coverage: metrics1.coverage.percentage.toFixed(1) + '%',
                workloadBalance: metrics1.workloadBalance.score.toFixed(3),
                fairness: metrics1.fairness.score.toFixed(3),
                efficiency: metrics1.efficiency.percentage.toFixed(1) + '%'
            },
            [label2]: {
                overallScore: metrics2.overallScore.percentage.toFixed(1) + '%',
                coverage: metrics2.coverage.percentage.toFixed(1) + '%',
                workloadBalance: metrics2.workloadBalance.score.toFixed(3),
                fairness: metrics2.fairness.score.toFixed(3),
                efficiency: metrics2.efficiency.percentage.toFixed(1) + '%'
            },
            winner: metrics1.overallScore.score > metrics2.overallScore.score ? label1 : label2,
            improvement: {
                overallScore: ((metrics2.overallScore.score - metrics1.overallScore.score) * 100).toFixed(1) + '%',
                coverage: ((metrics2.coverage.score - metrics1.coverage.score) * 100).toFixed(1) + '%',
                workloadBalance: ((metrics2.workloadBalance.score - metrics1.workloadBalance.score) * 100).toFixed(1) + '%',
                fairness: ((metrics2.fairness.score - metrics1.fairness.score) * 100).toFixed(1) + '%',
                efficiency: ((metrics2.efficiency.score - metrics1.efficiency.score) * 100).toFixed(1) + '%'
            }
        };

        return comparison;
    }
}

module.exports = AssignmentQualityMetrics; 