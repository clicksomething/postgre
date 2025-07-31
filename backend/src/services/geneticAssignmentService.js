const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');
const { 
  parseTimeToMinutes, 
  getDayName, 
  examsOverlap, 
  timeRangesOverlap,
  assertValidDate 
} = require('../utils/dateTimeUtils');
const ObserverUtils = require('../utils/observerUtils');
const AssignmentValidationService = require('./assignmentValidationService');
// ChromosomeStrategyService removed - using built-in methods instead

const { GA_CONSTANTS, GA_STRATEGY_NAMES, GA_MUTATION_TYPES } = require('../constants/geneticAlgorithmConstants');

class GeneticAssignmentService {
    constructor(options = {}) {
        // Validate parameters if provided
        if (options.populationSize && options.populationSize < 50) {
            throw new Error('Population size must be at least 50');
        }
        if (options.generations && options.generations < 20) {
            throw new Error('Number of generations must be at least 20');
        }
        if (options.mutationRate && (options.mutationRate < 0 || options.mutationRate > 1)) {
            throw new Error('Mutation rate must be between 0 and 1');
        }
        if (options.crossoverRate && (options.crossoverRate < 0 || options.crossoverRate > 1)) {
            throw new Error('Crossover rate must be between 0 and 1');
        }
        if (options.elitismRate && (options.elitismRate < 0 || options.elitismRate > 0.5)) {
            throw new Error('Elitism rate must be between 0 and 0.5');
        }
        
        // GA parameters with optimized defaults
        this.populationSize = options.populationSize || 300; // Larger population for better diversity
        this.generations = options.generations || 150; // More generations for better convergence
        this.baseMutationRate = options.mutationRate || 0.15; // Lower base mutation rate
        this.mutationRate = this.baseMutationRate;
        this.crossoverRate = options.crossoverRate || 0.85; // Higher crossover rate
        this.elitismRate = options.elitismRate || 0.1; // Keep 10% of best solutions
        this.tournamentSize = options.tournamentSize || 7; // Larger tournament for better selection pressure
        
        // Enhanced mutation rate adaptation parameters
        this.minMutationRate = options.minMutationRate || GA_CONSTANTS.DEFAULT_MIN_MUTATION_RATE;
        this.maxMutationRate = options.maxMutationRate || GA_CONSTANTS.DEFAULT_MAX_MUTATION_RATE;
        
        // Deterministic initialization option
        this.useDeterministicInit = options.useDeterministicInit;
        
        // Early convergence parameters
        this.convergenceGenerations = options.convergenceGenerations || 50;
        this.convergenceThreshold = options.convergenceThreshold || GA_CONSTANTS.DEFAULT_CONVERGENCE_THRESHOLD;
        
        // Restart mechanism parameters
        this.restartGenerations = options.restartGenerations || 40;
        
        // Local search parameters for hybrid approach
        this.localSearchRate = GA_CONSTANTS.DEFAULT_LOCAL_SEARCH_RATE; // Apply to top 20% of population
        this.localSearchIterations = GA_CONSTANTS.DEFAULT_LOCAL_SEARCH_ITERATIONS; // Maximum local search iterations per individual
        
        // Performance tracking
        this.performanceMetrics = {
            startTime: null,
            generations: [],
            b: 0,
            finalAssignments: 0,
            mutationRates: [],
            localSearchImprovements: []
        };
        
        // Initialize validation service
        this.validationService = new AssignmentValidationService();
    }


    /**
     * Calculate population diversity
     */
    calculateDiversity(population) {
        if (population.length <= 1) return 0;
        
        // Calculate average fitness
        const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
        
        // Calculate fitness variance
        const fitnessVariance = population.reduce((sum, ind) => {
            return sum + Math.pow(ind.fitness - avgFitness, 2);
        }, 0) / population.length;
        
        // Calculate chromosome diversity
        let chromosomeDiversity = 0;
        for (let i = 0; i < population.length; i++) {
            for (let j = i + 1; j < population.length; j++) {
                const diff = this.calculateChromosomeDifference(
                    population[i].chromosome,
                    population[j].chromosome
                );
                chromosomeDiversity += diff;
            }
        }
        chromosomeDiversity /= (population.length * (population.length - 1) / 2);
        
        // Combine both metrics (weighted average)
        return (GA_CONSTANTS.DIVERSITY_WEIGHTS.CHROMOSOME * chromosomeDiversity + GA_CONSTANTS.DIVERSITY_WEIGHTS.FITNESS_VARIANCE * fitnessVariance);
    }
    /**
     * Calculate difference between two chromosomes
     */
    calculateChromosomeDifference(chromosome1, chromosome2) {
        let differences = 0;
        const length = chromosome1.length;
        
        for (let i = 0; i < length; i++) {
            if (chromosome1[i].headId !== chromosome2[i].headId ||
                chromosome1[i].secretaryId !== chromosome2[i].secretaryId) {
                differences++;
            }
        }
        
        return differences / length;
    }
    /**
     * Update mutation rate based on population diversity and generation progress
     */
    updateMutationRate(population, currentGeneration) {
        const diversity = this.calculateDiversity(population);
        const progressRatio = currentGeneration / this.generations;
        
        // Enhanced adaptive mutation rate to escape local optima
        let newRate;
        
        // Check for stagnation (no improvement in recent generations)
        const recentGenerations = this.performanceMetrics.generations.slice(-15);
        const hasStagnation = recentGenerations.length >= 10 && 
            recentGenerations.every((gen, i) => i === 0 || 
                Math.abs(gen.bestFitness - recentGenerations[i-1].bestFitness) < GA_CONSTANTS.STAGNATION_THRESHOLD);
        
        if (hasStagnation) {
            // Stagnation detected - aggressive mutation
            newRate = Math.min(this.mutationRate * GA_CONSTANTS.MUTATION_ADAPTATION.STAGNATION_MULTIPLIER, this.maxMutationRate);
        } else if (diversity < GA_CONSTANTS.MUTATION_ADAPTATION.LOW_DIVERSITY_THRESHOLD) {
            // Low diversity - aggressive increase
            newRate = Math.min(this.mutationRate * GA_CONSTANTS.MUTATION_ADAPTATION.STAGNATION_MULTIPLIER, this.maxMutationRate);
        } else if (diversity < GA_CONSTANTS.MUTATION_ADAPTATION.MODERATE_DIVERSITY_THRESHOLD) {
            // Low diversity - moderate increase
            newRate = Math.min(this.mutationRate * GA_CONSTANTS.MUTATION_ADAPTATION.MODERATE_DIVERSITY_MULTIPLIER, this.maxMutationRate);
        } else if (diversity > GA_CONSTANTS.MUTATION_ADAPTATION.HIGH_DIVERSITY_THRESHOLD) {
            // High diversity - reduce mutation
            newRate = Math.max(this.mutationRate * GA_CONSTANTS.MUTATION_ADAPTATION.HIGH_DIVERSITY_MULTIPLIER, this.minMutationRate);
        } else {
            // Moderate diversity - keep base rate
            newRate = this.baseMutationRate;
        }
        
        // Progressive mutation rate increase based on generation progress
        if (progressRatio > GA_CONSTANTS.MUTATION_ADAPTATION.LATE_GENERATION_THRESHOLD && this.mutationRate < this.maxMutationRate * 0.8) {
            // In later generations, gradually increase mutation to escape local optima
            newRate = Math.min(newRate * GA_CONSTANTS.MUTATION_ADAPTATION.LATE_GENERATION_MULTIPLIER, this.maxMutationRate);
        }
        
        // Ensure rate stays within bounds
        this.mutationRate = Math.max(
            this.minMutationRate,
            Math.min(newRate, this.maxMutationRate)
        );
        
        // Track mutation rate changes
        this.performanceMetrics.mutationRates.push({
            generation: currentGeneration,
            rate: this.mutationRate,
            diversity: diversity,
            stagnation: hasStagnation,
            progressRatio: progressRatio
        });
        
        return this.mutationRate;
    }
    /**
     * Main entry point for genetic algorithm assignment
     */
    async assignObserversWithGA(examIds) {
        // Start the timer when assignment actually begins
        this.performanceMetrics.startTime = Date.now();
        
        try {
            await client.query('BEGIN');
            
            // 1. Load all necessary data
            const data = await this.loadData(client, examIds);
            console.log(`[GA] Loaded data: ${data.exams.length} exams, ${data.observers.length} observers, ${data.conflicts.length} conflicts`);
            
            // Track best fitness over generations for convergence detection
            let bestFitnessHistory = [];
            let bestOverallFitness = 0;
            let generationsWithoutImprovement = 0;
            
            // Reset mutation rate to base rate
            this.mutationRate = this.baseMutationRate;
            
            // Initialize population
            let population = this.initializePopulation(data);
            
            // 3. Evolution loop with timeout protection for large datasets
            const startTime = Date.now();
            const maxExecutionTime = 30 * 60 * 1000; // 30 minutes timeout
            
            for (let gen = 0; gen < this.generations; gen++) {
                // Check for timeout
                if (Date.now() - startTime > maxExecutionTime) {
                    console.log(`[GA] Timeout reached after ${gen} generations. Stopping evolution.`);
                    break;
                }
                
                try {
                // Evaluate fitness
                population = this.evaluateFitness(population, data);
                    
                    // Update mutation rate based on population state
                    this.updateMutationRate(population, gen);
                
                // Find best individual
                const bestIndividual = population.reduce((best, ind) => 
                    ind.fitness > best.fitness ? ind : best
                );
                    
                    // Update best fitness tracking
                    bestFitnessHistory.push(bestIndividual.fitness);
                    if (bestIndividual.fitness > bestOverallFitness) {
                        bestOverallFitness = bestIndividual.fitness;
                        generationsWithoutImprovement = 0;
                    } else {
                        generationsWithoutImprovement++;
                    }
                
                // Store progress
                this.performanceMetrics.generations.push({
                    generation: gen,
                    bestFitness: bestIndividual.fitness,
                        avgFitness: population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length,
                        mutationRate: this.mutationRate
                });
                    
                    // Log each generation with concise information
                    console.log(`[GA] Generation ${gen}: Best Fitness = ${bestIndividual.fitness.toFixed(3)}`);
                
                // Check for early convergence
                if (bestIndividual.fitness === 1.0) {
                        console.log('[GA] Perfect solution found at generation', gen);
                    break;
                }
                    
                    // Check for convergence
                    if (gen >= this.convergenceGenerations) {
                        const recentFitness = bestFitnessHistory.slice(-this.convergenceGenerations);
                        const fitnessImprovement = Math.abs(recentFitness[recentFitness.length - 1] - recentFitness[0]);
                        
                        if (fitnessImprovement < this.convergenceThreshold && bestOverallFitness > 0.85) {
                            console.log('[GA] Converged at generation', gen, 'with fitness', bestOverallFitness);
                            break;
                        }
                    }
                    
                    // Create next generation
                    population = this.evolvePopulation(population, data);
                        
                    // HYBRID APPROACH: Apply local search to best individuals
                    if (gen % 5 === 0 && gen > 0) { // Apply every 5 generations
                        population = this.applyLocalSearchToElite(population, data);
                    }
                    
                } catch (genError) {
                    console.error('[GA] Error in generation', gen, ':', genError);
                    throw genError;
                }
            }
            
                    // 4. Get best solution
        const bestSolution = population.reduce((best, ind) => 
            ind.fitness > best.fitness ? ind : best
        );
        
                    // Get the best solution from all islands
        
        // Don't repair the best solution at all - it was already validated during GA evolution
        // Just ensure no duplicates exist by keeping the BEST assignment for each exam (not just the first)
        const examMap = new Map();
        for (const gene of bestSolution.chromosome) {
            const currentGene = examMap.get(gene.examId);
            if (!currentGene) {
                // First occurrence of this exam
                examMap.set(gene.examId, gene);
            } else {
                // We already have this exam - keep the one with valid assignments
                const currentIsValid = currentGene.headId && currentGene.secretaryId && currentGene.headId !== currentGene.secretaryId;
                const newIsValid = gene.headId && gene.secretaryId && gene.headId !== gene.secretaryId;
                
                if (newIsValid && !currentIsValid) {
                    // New gene is valid, current is not - replace it
                    examMap.set(gene.examId, gene);
                } else if (newIsValid && currentIsValid) {
                    // Both are valid - keep the current one (first occurrence)
                    // This maintains the original order and avoids conflicts
                } else if (!newIsValid && !currentIsValid) {
                    // Both are invalid - keep the current one (first occurrence)
                }
                // If current is valid and new is not, keep current (already set)
            }
        }
        
        const validatedChromosome = [];
        for (const exam of data.exams) {
            const gene = examMap.get(exam.examid);
            if (gene) {
                validatedChromosome.push(gene);
            } else {
                // Add missing exam with null assignment
                validatedChromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
            // Solution after duplicate removal
        
        const validatedSolution = { ...bestSolution, chromosome: validatedChromosome };
        
        console.log(`[GA] Best solution found with fitness ${bestSolution.fitness.toFixed(3)}`);
        console.log(`[GA] Validated solution has ${validatedChromosome.filter(g => g.headId && g.secretaryId).length} valid assignments`);
            
                    // 5. Apply best solution to database
        const results = await this.applySolution(client, validatedSolution, data);
            console.log(`[GA] Applied solution: ${results.successful.length} successful, ${results.failed.length} failed out of ${data.exams.length} total exams`);
            
            await client.query('COMMIT');
            
            // Save performance report
            await this.savePerformanceReport(results, data);
            
            return results;
            
        } catch (error) {
            console.error('[GA] Error in genetic algorithm:', error);
            await client.query('ROLLBACK');
            throw error;
        }
    }
    /**
     * Load all necessary data for the GA
     */
    async loadData(client, examIds) {
        // Get exams
        const examsResult = await client.query(`
            SELECT 
                e.ExamID,
                e.ScheduleID,
                e.ExamName,
                e.ExamDate,
                e.StartTime,
                e.EndTime,
                e.NumOfStudents,
                TO_CHAR(e.ExamDate, 'Day') as DayOfWeek
            FROM ExamSchedule e
            WHERE e.ExamID = ANY($1)
            ORDER BY e.ExamDate, e.StartTime
        `, [examIds]);
        
        // Get observers with time slots
        const observersResult = await client.query(`
            SELECT 
                o.ObserverID,
                o.Name,
                o.Title,
                o.Availability,
                o.Email,
                o.PhoneNum,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'day', ts.day,
                            'startTime', ts.StartTime,
                            'endTime', ts.EndTime
                        ) ORDER BY ts.day, ts.StartTime
                    ) FILTER (WHERE ts.TimeSlotID IS NOT NULL),
                    '[]'::json
                ) as time_slots
            FROM Observer o
            LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
            WHERE o.Availability IS NULL 
               OR LOWER(o.Availability::text) IN ('full-time', 'part-time')
            GROUP BY o.ObserverID, o.Name, o.Title, o.Availability, o.Email, o.PhoneNum
        `);
        
        // Get existing conflicts
        const scheduleId = examsResult.rows[0]?.scheduleid;
        const examDates = [...new Set(examsResult.rows.map(e => e.examdate))];
        
        const conflictsResult = await client.query(`
            SELECT 
                ea.ObserverID,
                es.ExamDate,
                es.StartTime,
                es.EndTime,
                es.ExamID
            FROM ExamAssignment ea
            JOIN ExamSchedule es ON ea.ExamID = es.ExamID
            WHERE ea.Status = 'active'
            AND es.ExamDate = ANY($1)
            AND es.ScheduleID = $2
        `, [examDates, scheduleId]);
        
        return {
            exams: examsResult.rows,
            observers: observersResult.rows,
            conflicts: conflictsResult.rows,
            scheduleId
        };
    }
    /**
     * Initialize population with random chromosomes
     */
    initializePopulation(data) {
        const population = [];
        
        // Create diverse high-quality initial population using multiple strategies
        if (this.useDeterministicInit && this.populationSize > 0) {
            // Strategy 1: Constraint-aware approach
            const constraintAwareChromosome = this.createConstraintAwareChromosome(data, true);
            const validatedConstraint = this.validateAndRepairChromosome(constraintAwareChromosome, data);
            population.push({ chromosome: validatedConstraint, fitness: 0, strategy: 'constraint-aware' });
            
            // Strategy 2: Qualification-optimized approach
            const qualificationOptimizedChromosome = this.createQualificationOptimizedChromosome(data, true);
            const validatedQualification = this.validateAndRepairChromosome(qualificationOptimizedChromosome, data);
            population.push({ chromosome: validatedQualification, fitness: 0, strategy: 'qualification-optimized' });
            
            // Strategy 3: Time-slot optimized approach
            const timeSlotOptimizedChromosome = this.createTimeSlotOptimizedChromosome(data, true);
            const validatedTimeSlot = this.validateAndRepairChromosome(timeSlotOptimizedChromosome, data);
            population.push({ chromosome: validatedTimeSlot, fitness: 0, strategy: 'time-slot-optimized' });
            
            // Add more randomized variants of each strategy
            const strategies = [
                () => this.createConstraintAwareChromosome(data, true),
                () => this.createQualificationOptimizedChromosome(data, true),
                () => this.createTimeSlotOptimizedChromosome(data, true)
            ];
            
            // Add 3-5 randomized variants of each strategy
            for (let i = 0; i < Math.min(5, Math.floor(this.populationSize * 0.1)); i++) {
                const strategyIndex = i % strategies.length;
                const variantChromosome = strategies[strategyIndex]();
                const validatedVariant = this.validateAndRepairChromosome(variantChromosome, data);
                population.push({ chromosome: validatedVariant, fitness: 0, strategy: `randomized-${strategyIndex}` });
            }
        }
        
        // Fill rest with improved random chromosomes
        while (population.length < this.populationSize) {
            const chromosome = this.createImprovedRandomChromosome(data);
            const validatedChromosome = this.validateAndRepairChromosome(chromosome, data);
            population.push({ chromosome: validatedChromosome, fitness: 0, strategy: 'improved-random' });
        }
        
        // Log validation statistics
        const validAssignments = population.map(p => 
            p.chromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length
        );
        const avgValidAssignments = validAssignments.reduce((a, b) => a + b, 0) / validAssignments.length;
        
        // Store initial population quality for restart decisions
        this.initialPopulationQuality = avgValidAssignments / data.exams.length;
        
        // Only log a single summary line for initialization
        console.log(`[GA] Initial population: ${population.length} individuals, quality ${(this.initialPopulationQuality * 100).toFixed(1)}%`);
        
        return population;
    }

    /**
     * Create a constraint-aware chromosome
     */
    createConstraintAwareChromosome(data, addRandomization = false) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Pre-analyze constraint density for each exam
        const examConstraintDensity = new Map();
        data.exams.forEach(exam => {
            const examDate = new Date(exam.examdate);
            const conflictingExams = data.exams.filter(otherExam => {
                if (otherExam.examid === exam.examid) return false;
                const otherDate = new Date(otherExam.examdate);
                return examDate.getTime() === otherDate.getTime() &&
                       exam.starttime < otherExam.endtime && exam.endtime > otherExam.starttime;
            });
            examConstraintDensity.set(exam.examid, conflictingExams.length);
        });
        
        // Sort exams by constraint density (most constrained first)
        const sortedExams = [...data.exams].sort((a, b) => {
            const densityA = examConstraintDensity.get(a.examid) || 0;
            const densityB = examConstraintDensity.get(b.examid) || 0;
            return densityB - densityA; // Most constrained first
        });
        
        for (const exam of sortedExams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Score observers by their availability for this specific exam - DIFFERENT APPROACH
                const scoredObservers = availableObservers.map(observer => {
                    let score = 1;
                    
                    // Check how many other exams this observer is already assigned to on the same day
                    const observerExams = observerUsage.get(observer.observerid) || [];
                    const sameDayExams = observerExams.filter(assignedExam => {
                        const assignedDate = new Date(assignedExam.examdate);
                        const examDate = new Date(exam.examdate);
                        return assignedDate.getTime() === examDate.getTime();
                    });
                    
                    // Use quadratic penalty for same-day assignments instead of linear
                    score /= (1 + Math.pow(sameDayExams.length, 2) * 0.2);
                    
                    // Bonus for observers with Dr. title (different from greedy)
                    if (ObserverUtils.isDoctor(observer)) {
                        score *= GA_CONSTANTS.OBSERVER_SCORING.CONSTRAINT_AWARE_BONUS; // Smaller bonus than greedy
                    }
                    
                    // Add randomization if requested
                    if (addRandomization) {
                        score *= (0.6 + Math.random() * 0.8); // ±40% variation
                    }
                    
                    return { observer, score };
                });
                
                scoredObservers.sort((a, b) => b.score - a.score);
                
                // Select with different logic
                let head, secretary;
                if (addRandomization && scoredObservers.length > 4) {
                    // Select from top 4 candidates randomly
                    const headCandidates = scoredObservers.slice(0, 4);
                    const headIndex = Math.floor(Math.random() * headCandidates.length);
                    head = headCandidates[headIndex].observer;
                } else {
                    head = scoredObservers[0].observer;
                }
                
                const secretaryCandidates = scoredObservers
                    .filter(o => o.observer.observerid !== head.observerid)
                    .sort((a, b) => b.score - a.score);
                
                if (addRandomization && secretaryCandidates.length > 3) {
                    const secCandidates = secretaryCandidates.slice(0, 3);
                    const secIndex = Math.floor(Math.random() * secCandidates.length);
                    secretary = secCandidates[secIndex].observer;
                } else {
                    secretary = secretaryCandidates[0].observer;
                }
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Create a qualification-optimized chromosome
     */
    createQualificationOptimizedChromosome(data, addRandomization = false) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Categorize observers by qualification
        const drObservers = data.observers.filter(o => 
            ObserverUtils.isDoctor(o)
        );
        const nonDrObservers = data.observers.filter(o => 
            !ObserverUtils.isDoctor(o)
        );
        
        for (const exam of data.exams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Separate available observers by qualification
                const availableDr = availableObservers.filter(o => 
                    ObserverUtils.isDoctor(o)
                );
                const availableNonDr = availableObservers.filter(o => 
                    !ObserverUtils.isDoctor(o)
                );
                
                let head, secretary;
                
                // Prefer Dr. for head position if available
                if (availableDr.length > 0) {
                    head = availableDr[0];
                    // For secretary, prefer non-Dr. to balance qualifications
                    const secretaryCandidates = availableObservers.filter(o => 
                        o.observerid !== head.observerid
                    );
                    secretary = secretaryCandidates[0];
                } else {
                    // If no Dr. available, use best available
                    head = availableObservers[0];
                    secretary = availableObservers[1];
                }
                
                // Add randomization if requested
                if (addRandomization && availableObservers.length > 2) {
                    const headCandidates = availableObservers.slice(0, Math.min(3, availableObservers.length));
                    const headIndex = Math.floor(Math.random() * headCandidates.length);
                    head = headCandidates[headIndex];
                    
                    const secretaryCandidates = availableObservers.filter(o => 
                        o.observerid !== head.observerid
                    );
                    const secIndex = Math.floor(Math.random() * Math.min(3, secretaryCandidates.length));
                    secretary = secretaryCandidates[secIndex];
                }
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Create a time-slot optimized chromosome
     */
    createTimeSlotOptimizedChromosome(data, addRandomization = false) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Group observers by availability type
        const fullTimeObservers = data.observers.filter(o => 
            o.availability === 'full-time' || !o.availability
        );
        const partTimeObservers = data.observers.filter(o => 
            o.availability === 'part-time'
        );
        
        for (const exam of data.exams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Separate by availability type
                const availableFullTime = availableObservers.filter(o => 
                    o.availability === 'full-time' || !o.availability
                );
                const availablePartTime = availableObservers.filter(o => 
                    o.availability === 'part-time'
                );
                
                let head, secretary;
                
                // Prefer full-time observers for head position
                if (availableFullTime.length > 0) {
                    head = availableFullTime[0];
                    // For secretary, prefer part-time if available to balance workload
                    if (availablePartTime.length > 0) {
                        secretary = availablePartTime[0];
                    } else {
                        const secretaryCandidates = availableObservers.filter(o => 
                            o.observerid !== head.observerid
                        );
                        secretary = secretaryCandidates[0];
                    }
                } else {
                    // If only part-time available, use them
                    head = availableObservers[0];
                    secretary = availableObservers[1];
                }
                
                // Add randomization if requested
                if (addRandomization && availableObservers.length > 2) {
                    const headCandidates = availableObservers.slice(0, Math.min(3, availableObservers.length));
                    const headIndex = Math.floor(Math.random() * headCandidates.length);
                    head = headCandidates[headIndex];
                    
                    const secretaryCandidates = availableObservers.filter(o => 
                        o.observerid !== head.observerid
                    );
                    const secIndex = Math.floor(Math.random() * Math.min(3, secretaryCandidates.length));
                    secretary = secretaryCandidates[secIndex];
                }
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Create an improved random chromosome with better constraint handling
     */
    createImprovedRandomChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Sort exams by difficulty (most constrained first)
        const examDifficulty = new Map();
        data.exams.forEach(exam => {
            const examDate = new Date(exam.examdate);
            const conflictingExams = data.exams.filter(otherExam => {
                if (otherExam.examid === exam.examid) return false;
                const otherDate = new Date(otherExam.examdate);
                return examDate.getTime() === otherDate.getTime() &&
                       exam.starttime < otherExam.endtime && exam.endtime > otherExam.starttime;
            });
            examDifficulty.set(exam.examid, conflictingExams.length);
        });
        
        const sortedExams = [...data.exams].sort((a, b) => {
            const difficultyA = examDifficulty.get(a.examid) || 0;
            const difficultyB = examDifficulty.get(b.examid) || 0;
            return difficultyB - difficultyA; // Most difficult first
        });
        
        for (const exam of sortedExams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Weighted random selection based on observer characteristics
                const weightedObservers = availableObservers.map(observer => {
                    let weight = 1;
                    
                    // Prefer Dr. for head position
                    if (ObserverUtils.isDoctor(observer)) {
                        weight *= GA_CONSTANTS.OBSERVER_SCORING.DR_TITLE_BONUS;
                    }
                    
                    // Prefer full-time observers
                    if (observer.availability === 'full-time' || !observer.availability) {
                        weight *= 1.2;
                    }
                    
                    // Penalize high workload
                    const currentWorkload = observerUsage.get(observer.observerid)?.length || 0;
                    weight /= (1 + currentWorkload * 0.2);
                    
                    return { observer, weight };
                });
                
                // Weighted random selection
                const totalWeight = weightedObservers.reduce((sum, w) => sum + w.weight, 0);
                let random = Math.random() * totalWeight;
                
                let head = null;
                for (const weighted of weightedObservers) {
                    random -= weighted.weight;
                    if (random <= 0) {
                        head = weighted.observer;
                        break;
                    }
                }
                
                // Select secretary from remaining observers
                const secretaryCandidates = weightedObservers.filter(w => 
                    w.observer.observerid !== head.observerid
                );
                const secTotalWeight = secretaryCandidates.reduce((sum, w) => sum + w.weight, 0);
                random = Math.random() * secTotalWeight;
                
                let secretary = null;
                for (const weighted of secretaryCandidates) {
                    random -= weighted.weight;
                    if (random <= 0) {
                        secretary = weighted.observer;
                        break;
                    }
                }
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Create a random valid chromosome (assignment solution)
     */
    createRandomChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        
        for (const exam of data.exams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Randomly select 2 observers
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                // Update usage
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                // No valid assignment
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Get available observers for an exam considering constraints
     */
    getAvailableObserversForExam(exam, observers, currentUsage, existingConflicts) {
        const examDate = new Date(exam.examdate);
        const examDay = examDate.toLocaleString('en-US', { weekday: 'long' });
        
        const availableObservers = observers.filter(observer => {
            // Check availability type - handle case sensitivity and null values
            const availability = observer.availability ? observer.availability.toLowerCase() : 'full-time';
            
            // Full-time observers or those without availability set (treated as full-time)
            if (availability === 'full-time' || !observer.availability) {
                // Only need to check conflicts for full-time observers
                
                // Check conflicts with current assignments (in-memory tracking)
                const observerExams = currentUsage.get(observer.observerid) || [];
                const hasCurrentConflict = observerExams.some(assignedExam => {
                    const assignedDate = new Date(assignedExam.examdate);
                    if (assignedDate.getTime() !== examDate.getTime()) return false;
                    return (exam.starttime < assignedExam.endtime && exam.endtime > assignedExam.starttime);
                });
                
                if (hasCurrentConflict) return false;
                
                // Check existing conflicts in database
                const hasExistingConflict = existingConflicts.some(conflict => {
                    if (conflict.observerid !== observer.observerid) return false;
                    const conflictDate = new Date(conflict.examdate);
                    if (conflictDate.getTime() !== examDate.getTime()) return false;
                    
                    const conflictStart = conflict.starttime || conflict.startTime;
                    const conflictEnd = conflict.endtime || conflict.endTime;
                    return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
                });
                
                return !hasExistingConflict;
            } 
            // Part-time observers
            else if (availability === 'part-time') {
                // Check time slots first
                const slots = observer.time_slots || [];
                if (slots.length === 0) return false;
                
                const hasMatchingSlot = slots.some(slot => {
                    if (!slot) return false;
                    
                    // Normalize day names
                    const slotDay = slot.day ? slot.day.toLowerCase().trim() : '';
                    const examDayLower = examDay.toLowerCase().trim();
                    
                    if (slotDay !== examDayLower) return false;
                    
                    // Use bulletproof time parsing
                    const slotStartMinutes = parseTimeToMinutes(slot.starttime || slot.startTime);
                    const slotEndMinutes = parseTimeToMinutes(slot.endtime || slot.endTime);
                    const examStartMinutes = parseTimeToMinutes(exam.starttime);
                    const examEndMinutes = parseTimeToMinutes(exam.endtime);
                    
                    return slotStartMinutes <= examStartMinutes && slotEndMinutes >= examEndMinutes;
                });
                
                if (!hasMatchingSlot) return false;
            
                // Then check conflicts
                const observerExams = currentUsage.get(observer.observerid) || [];
                const hasCurrentConflict = observerExams.some(assignedExam => {
                    const assignedDate = new Date(assignedExam.examdate);
                    if (assignedDate.getTime() !== examDate.getTime()) return false;
                    return (exam.starttime < assignedExam.endtime && exam.endtime > assignedExam.starttime);
                });
            
                if (hasCurrentConflict) return false;
            
                const hasExistingConflict = existingConflicts.some(conflict => {
                    if (conflict.observerid !== observer.observerid) return false;
                    const conflictDate = new Date(conflict.examdate);
                    if (conflictDate.getTime() !== examDate.getTime()) return false;
                
                    const conflictStart = conflict.starttime || conflict.startTime;
                    const conflictEnd = conflict.endtime || conflict.endTime;
                    return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
                });
            
                return !hasExistingConflict;
            }
            
            return false; // Unknown availability type
        });
        
        // Sort available observers by preference (like random algorithm)
        availableObservers.sort((a, b) => {
            // Prefer Dr. titles for head positions
            const isDrA = a.title && a.title.toLowerCase().includes('dr');
            const isDrB = b.title && b.title.toLowerCase().includes('dr');
            if (isDrA !== isDrB) return isDrA ? -1 : 1;
            
            // Then by current usage (lower is better)
            const usageA = currentUsage.get(a.observerid)?.length || 0;
            const usageB = currentUsage.get(b.observerid)?.length || 0;
            return usageA - usageB;
        });
        
        return availableObservers;
    }
    /**
     * Update observer usage tracking
     */
    updateObserverUsage(observerUsage, observerId, exam) {
        if (!observerId) return;
        
        if (!observerUsage.has(observerId)) {
            observerUsage.set(observerId, []);
        }
        
        observerUsage.get(observerId).push({
            examdate: new Date(exam.examdate),
            starttime: exam.starttime,
            endtime: exam.endtime
        });
    }
    /**
     * Evaluate fitness of all individuals
     */
    evaluateFitness(population, data) {
        return population.map(individual => {
            const fitness = this.calculateFitness(individual.chromosome, data);
            return { ...individual, fitness };
        });
    }
    /**
     * Calculate fitness score for a chromosome
     */
    calculateFitness(chromosome, data) {
        let score = 0;
        
        // 1. Assignment coverage - This is the PRIMARY objective
        const assignedCount = chromosome.filter(gene => gene.headId && gene.secretaryId && gene.headId !== gene.secretaryId).length;
        const assignmentScore = assignedCount / chromosome.length;
        
        // PRIMARY: Make assignment coverage the dominant factor
        // A chromosome with 100% coverage should have fitness > 0.95
        score = assignmentScore * GA_CONSTANTS.FITNESS.PRIMARY_COVERAGE_WEIGHT;
        
        // Only add secondary factors if we have good assignment coverage
        if (assignmentScore > GA_CONSTANTS.FITNESS.COVERAGE_THRESHOLD_FOR_BONUSES) {
            // 2. Workload balance score
            let workloadScore = 0;
            const observerWorkload = new Map();
            
            // Calculate current workload for each observer
            for (let i = 0; i < chromosome.length; i++) {
                const gene = chromosome[i];
                if (gene.headId && gene.secretaryId) {
                    observerWorkload.set(gene.headId, (observerWorkload.get(gene.headId) || 0) + 1);
                    observerWorkload.set(gene.secretaryId, (observerWorkload.get(gene.secretaryId) || 0) + 1);
                }
            }
            
            // Calculate workload variance (lower is better)
            const workloads = Array.from(observerWorkload.values());
            if (workloads.length > 0) {
                const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
                const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
                workloadScore = Math.max(0, 1 - variance / avgWorkload);
            }
            
            // 3. Fairness score (prefer observers with lower current workload)
            let fairnessScore = 0;
            for (let i = 0; i < chromosome.length; i++) {
                const gene = chromosome[i];
                if (gene.headId && gene.secretaryId) {
                    const headWorkload = observerWorkload.get(gene.headId) || 0;
                    const secretaryWorkload = observerWorkload.get(gene.secretaryId) || 0;
                    
                    // Prefer assignments where both observers have low workload
                    const maxWorkload = Math.max(headWorkload, secretaryWorkload);
                    fairnessScore += Math.max(0, 1 - maxWorkload / 10); // Normalize by max expected workload
                }
            }
            fairnessScore = Math.min(fairnessScore / chromosome.length, 1);
            
            // 4. Efficiency score (prefer consecutive assignments for same observers)
            let efficiencyScore = 0;
            for (let i = 1; i < chromosome.length; i++) {
                const prev = chromosome[i - 1];
                const curr = chromosome[i];
                if (prev.headId && curr.headId) {
                    const prevExam = data.exams[i - 1];
                    const currExam = data.exams[i];
                    // If exams are on same day and consecutive, prefer same observers
                    if (prevExam.examdate === currExam.examdate && 
                        prevExam.endtime === currExam.starttime) {
                        if (prev.headId === curr.headId || prev.secretaryId === curr.secretaryId) {
                            efficiencyScore += GA_CONSTANTS.FITNESS.EFFICIENCY_BONUS_PER_CONTINUITY;
                        }
                    }
                }
            }
            efficiencyScore = Math.min(efficiencyScore / chromosome.length, 1);
            
            // Add small bonuses for secondary factors
            score += GA_CONSTANTS.FITNESS.WORKLOAD_SCORE_WEIGHT * workloadScore + GA_CONSTANTS.FITNESS.FAIRNESS_SCORE_WEIGHT * fairnessScore + GA_CONSTANTS.FITNESS.EFFICIENCY_SCORE_WEIGHT * efficiencyScore;
        }
        
        // MASSIVE bonus for perfect or near-perfect coverage
        if (assignmentScore >= GA_CONSTANTS.FITNESS.PERFECT_COVERAGE_THRESHOLD) {
            score = GA_CONSTANTS.FITNESS.PERFECT_SCORE; // Perfect score for 99%+ coverage
        } else if (assignmentScore >= GA_CONSTANTS.FITNESS.VERY_HIGH_COVERAGE_THRESHOLD) {
            score = GA_CONSTANTS.FITNESS.VERY_HIGH_SCORE; // Very high score for 95%+ coverage
        } else if (assignmentScore >= GA_CONSTANTS.FITNESS.HIGH_COVERAGE_THRESHOLD) {
            score = GA_CONSTANTS.FITNESS.HIGH_SCORE; // High score for 90%+ coverage
        } else if (assignmentScore >= GA_CONSTANTS.FITNESS.GOOD_COVERAGE_THRESHOLD) {
            score = GA_CONSTANTS.FITNESS.GOOD_SCORE; // Good score for 80%+ coverage
        }
        
        // Severe penalty for very low assignment success
        if (assignmentScore < GA_CONSTANTS.FITNESS.VERY_LOW_COVERAGE_THRESHOLD) {
            score *= GA_CONSTANTS.FITNESS.VERY_LOW_PENALTY; // 90% penalty for very low assignment success
        } else if (assignmentScore < GA_CONSTANTS.FITNESS.LOW_COVERAGE_THRESHOLD) {
            score *= GA_CONSTANTS.FITNESS.LOW_PENALTY; // 70% penalty for low assignment success
        }
        
        return score;
    }
    /**
     * Evolve population to next generation
     */
    evolvePopulation(population, data) {
        const newPopulation = [];
        
        // Check for stagnation
        const recentGenerations = this.performanceMetrics.generations.slice(-15);
        const hasStagnation = recentGenerations.length >= 10 && 
            recentGenerations.every((gen, i) => i === 0 || 
                Math.abs(gen.bestFitness - recentGenerations[i-1].bestFitness) < GA_CONSTANTS.STAGNATION_THRESHOLD);
        
        // Elitism - keep best individuals
        const eliteCount = Math.floor(this.populationSize * this.elitismRate);
        const sortedPop = [...population].sort((a, b) => b.fitness - a.fitness);
        for (let i = 0; i < eliteCount; i++) {
            // Preserve all properties including isGreedy flag
            newPopulation.push({ ...sortedPop[i] });
        }
        
        // Generate rest of population
        while (newPopulation.length < this.populationSize) {
            // Tournament selection
            const parent1 = this.tournamentSelection(population);
            const parent2 = this.tournamentSelection(population);
            
            // Crossover
            let offspring1, offspring2;
            if (Math.random() < this.crossoverRate) {
                [offspring1, offspring2] = this.crossover(parent1, parent2, data);
            } else {
                offspring1 = { ...parent1, isGreedy: false };
                offspring2 = { ...parent2, isGreedy: false };
            }
            
            // Mutation
            if (Math.random() < this.mutationRate) {
                // Apply mutation strategies based on stagnation
                if (hasStagnation) {
                    // During stagnation, use more aggressive mutation
                    if (Math.random() < 0.5) {
                        this.applyBlockMutation(offspring1.chromosome, data);
                    } else {
                        this.applyCatastrophicMutation(offspring1.chromosome, data);
                    }
                } else {
                    // Normal mutation
                    this.applyStandardMutation(offspring1.chromosome, data);
                }
            }
            if (Math.random() < this.mutationRate) {
                // Apply mutation strategies based on stagnation
                if (hasStagnation) {
                    // During stagnation, use more aggressive mutation
                    if (Math.random() < 0.5) {
                        this.applyBlockMutation(offspring2.chromosome, data);
                    } else {
                        this.applyCatastrophicMutation(offspring2.chromosome, data);
                    }
                } else {
                    // Normal mutation
                    this.applyStandardMutation(offspring2.chromosome, data);
                }
            }
            
            // New offspring are not greedy
            offspring1.isGreedy = false;
            offspring2.isGreedy = false;
            
            newPopulation.push(offspring1);
            if (newPopulation.length < this.populationSize) {
                newPopulation.push(offspring2);
            }
        }
        
        return newPopulation;
    }
    /**
     * Tournament selection
     */
    tournamentSelection(population) {
        const tournament = [];
        for (let i = 0; i < this.tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }
        return tournament.reduce((best, ind) => ind.fitness > best.fitness ? ind : best);
    }
    /**
     * Crossover operation - Fixed to be position-based (each position = specific exam)
     */
    crossover(parent1, parent2, data) {
        const length = parent1.chromosome.length;
        
        // Create offspring by swapping assignments for the same exam positions
        const offspring1Chromosome = [];
        const offspring2Chromosome = [];
        
        for (let i = 0; i < length; i++) {
            // Each position i represents the same exam in both parents
            const exam = data.exams[i];
            
            // Randomly decide whether to swap this position
            if (Math.random() < GA_CONSTANTS.CROSSOVER.POSITION_SWAP_PROBABILITY) {
                // Swap assignments for this exam
                offspring1Chromosome.push(parent2.chromosome[i]);
                offspring2Chromosome.push(parent1.chromosome[i]);
            } else {
                // Keep original assignments for this exam
                offspring1Chromosome.push(parent1.chromosome[i]);
                offspring2Chromosome.push(parent2.chromosome[i]);
            }
        }
        
        // Ensure each offspring has exactly one gene per exam (no duplicates)
        const offspring1 = {
            chromosome: this.validateAndRepairChromosome(offspring1Chromosome, data),
            fitness: 0
        };
        
        const offspring2 = {
            chromosome: this.validateAndRepairChromosome(offspring2Chromosome, data),
            fitness: 0
        };
        
        return [offspring1, offspring2];
    }


    /**
     * Inject diversity into population to escape local optima
     */
    injectDiversity(population, data) {
        const newPopulation = [...population];
        const injectionCount = Math.floor(population.length * 0.2); // Replace 20% of population
        
        // Sort by fitness to keep best individuals
        newPopulation.sort((a, b) => b.fitness - a.fitness);
        
        // Replace worst individuals with diverse new ones using chromosome service
        const diversityChromosomes = this.chromosomeService.createDiversityChromosomes(data, injectionCount);
        
        for (let i = 0; i < injectionCount; i++) {
            const replacementIndex = newPopulation.length - 1 - i;
            const validatedChromosome = this.validateAndRepairChromosome(diversityChromosomes[i].chromosome, data);
            
            newPopulation[replacementIndex] = {
                chromosome: validatedChromosome,
                fitness: 0,
                isGreedy: false,
                strategy: diversityChromosomes[i].strategy
            };
        }
        
        return newPopulation;
    }
    /**
     * Create diverse restart population with different strategies
     */
    createDiverseRestartPopulation(data, bestIndividual, restartType) {
        const population = [];
        const populationSize = this.populationSize;
        
        console.log(`[GA] Creating ${restartType} restart population`);
        
        switch (restartType) {
            case 'strategy-shift':
                // Use completely different approaches
                // 1. Force assignment strategy - assign even if conflicts exist, then repair
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.chromosomeService.createForceAssignmentChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-force-assign' 
                    });
                }
                
                // 2. Observer preference strategy - prioritize different observers
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.chromosomeService.createObserverPreferenceChromosome(data, i % data.observers.length);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-observer-pref' 
                    });
                }
                
                // 3. Time-based strategy - focus on specific time slots
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.chromosomeService.createTimeBasedChromosome(data, i % 24); // Different hours
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-time-based' 
                    });
                }
                
                // 4. Conflict-tolerant strategy - allow some conflicts
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.chromosomeService.createConflictTolerantChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-conflict-tolerant' 
                    });
                }
                
                // 5. Fill rest with completely random
                while (population.length < populationSize) {
                    const chromosome = this.chromosomeService.createCompletelyRandomChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-completely-random' 
                    });
                }
                break;
                
            case 'random-focus':
                // Focus on high diversity random generation
                // 1. 50% completely random
                for (let i = 0; i < Math.floor(populationSize * 0.5); i++) {
                    const chromosome = this.chromosomeService.createCompletelyRandomChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-completely-random' 
                    });
                }
                
                // 2. 30% random with observer rotation
                for (let i = 0; i < Math.floor(populationSize * 0.3); i++) {
                    const chromosome = this.chromosomeService.createObserverRotationChromosome(data, i);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-observer-rotation' 
                    });
                }
                
                // 3. 20% random with time slot focus
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.chromosomeService.createTimeSlotRandomChromosome(data, i);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-time-slot-random' 
                    });
                }
                break;
                
            case 'hybrid':
                // Mix of aggressive strategies
                // 1. 25% force assignment
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.chromosomeService.createForceAssignmentChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-force' 
                    });
                }
                
                // 2. 25% conflict tolerant
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.chromosomeService.createConflictTolerantChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-conflict' 
                    });
                }
                
                // 3. 25% observer preference
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.chromosomeService.createObserverPreferenceChromosome(data, i % data.observers.length);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-pref' 
                    });
                }
                
                // 4. 25% completely random
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.chromosomeService.createCompletelyRandomChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-random' 
                    });
                }
                break;
        }
        
        // Add best individual from previous run (but not always in the same position)
        const bestIndex = Math.floor(Math.random() * population.length);
        population[bestIndex] = { ...bestIndividual };
        
        // Log restart population statistics
        const validAssignments = population.map(p => 
            p.chromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length
        );
        const avgValidAssignments = validAssignments.reduce((a, b) => a + b, 0) / validAssignments.length;
        const maxValidAssignments = Math.max(...validAssignments);
        
        console.log(`[GA] Restart population created: ${avgValidAssignments.toFixed(1)} avg, ${maxValidAssignments} max valid assignments out of ${data.exams.length}`);
        
        return population;
    }
    /**
     * Create a highly randomized chromosome for restart scenarios
     */
    createHighlyRandomizedChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        // Sort exams by difficulty (most constrained first)
        const examDifficulty = new Map();
        data.exams.forEach(exam => {
            const examDate = new Date(exam.examdate);
            const conflictingExams = data.exams.filter(otherExam => {
                if (otherExam.examid === exam.examid) return false;
                const otherDate = new Date(otherExam.examdate);
                return examDate.getTime() === otherDate.getTime() &&
                       exam.starttime < otherExam.endtime && exam.endtime > otherExam.starttime;
            });
            examDifficulty.set(exam.examid, conflictingExams.length);
        });
        
        const sortedExams = [...data.exams].sort((a, b) => {
            const difficultyA = examDifficulty.get(a.examid) || 0;
            const difficultyB = examDifficulty.get(b.examid) || 0;
            return difficultyB - difficultyA; // Most difficult first
        });
        
        for (const exam of sortedExams) {
            if (processedExams.has(exam.examid)) continue;
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Completely random selection with high diversity
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
                processedExams.add(exam.examid);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
                processedExams.add(exam.examid);
            }
        }
        
        return chromosome;
    }
    /**
     * Create a force assignment chromosome - assign observers even if conflicts exist
     */
    createForceAssignmentChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        for (const exam of data.exams) {
            if (processedExams.has(exam.examid)) continue;
            
            // First try to get available observers
            let availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            // If not enough available, add some observers with conflicts (but still different observers)
            if (availableObservers.length < 2) {
                const allObservers = data.observers.filter(o => 
                    !availableObservers.some(ao => ao.observerid === o.observerid)
                );
                availableObservers = [...availableObservers, ...allObservers.slice(0, 2 - availableObservers.length)];
            }
            
            if (availableObservers.length >= 2) {
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                // Update usage even if there might be conflicts
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Create a chromosome with observer preference strategy
     */
    createObserverPreferenceChromosome(data, preferredObserverIndex) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        // Sort observers to prioritize the preferred observer
        const sortedObservers = [...data.observers];
        if (preferredObserverIndex < sortedObservers.length) {
            const preferred = sortedObservers.splice(preferredObserverIndex, 1)[0];
            sortedObservers.unshift(preferred);
        }
        
        for (const exam of data.exams) {
            if (processedExams.has(exam.examid)) continue;
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                sortedObservers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Prefer the first available observer (which should be the preferred one if available)
                const head = availableObservers[0];
                const secretary = availableObservers[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Create a time-based chromosome focusing on specific hours
     */
    createTimeBasedChromosome(data, focusHour) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        // Sort exams by how close they are to the focus hour
        const sortedExams = [...data.exams].sort((a, b) => {
            const hourA = Math.floor(parseTimeToMinutes(a.starttime) / 60);
            const hourB = Math.floor(parseTimeToMinutes(b.starttime) / 60);
            const distanceA = Math.abs(hourA - focusHour);
            const distanceB = Math.abs(hourB - focusHour);
            return distanceA - distanceB; // Closest to focus hour first
        });
        
        for (const exam of sortedExams) {
            if (processedExams.has(exam.examid)) continue;
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Create a conflict-tolerant chromosome that allows some conflicts
     */
    createConflictTolerantChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        for (const exam of data.exams) {
            if (processedExams.has(exam.examid)) continue;
            
            // First try to get available observers
            let availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            // If not enough available, add some observers with conflicts
            if (availableObservers.length < 2) {
                const allObservers = data.observers.filter(o => 
                    !availableObservers.some(ao => ao.observerid === o.observerid)
                );
                availableObservers = [...availableObservers, ...allObservers.slice(0, 2 - availableObservers.length)];
            }
            
            if (availableObservers.length >= 2) {
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                // Update usage even if there might be conflicts
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Create a completely random chromosome that respects basic constraints
     */
    createCompletelyRandomChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Shuffle exams for random processing order
        const shuffledExams = this.shuffleArray([...data.exams]);
        
        for (const exam of shuffledExams) {
            // Get available observers but with high randomization
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Completely random selection from available observers
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        return chromosome;
    }
    /**
     * Create a chromosome with observer rotation strategy
     */
    createObserverRotationChromosome(data, rotationOffset) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        // Rotate observers based on offset
        const rotatedObservers = [...data.observers];
        for (let i = 0; i < rotationOffset; i++) {
            rotatedObservers.push(rotatedObservers.shift());
        }
        
        for (const exam of data.exams) {
            if (processedExams.has(exam.examid)) continue;
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                rotatedObservers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                const head = availableObservers[0];
                const secretary = availableObservers[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Create a random chromosome with time slot focus
     */
    createTimeSlotRandomChromosome(data, timeSlotIndex) {
        const chromosome = [];
        const observerUsage = new Map();
        const processedExams = new Set();
        
        // Focus on specific time slots
        const timeSlots = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const focusDay = timeSlots[timeSlotIndex % timeSlots.length];
        
        // Sort exams by day, prioritizing the focus day
        const sortedExams = [...data.exams].sort((a, b) => {
            const dayA = new Date(a.examdate).toLocaleString('en-US', { weekday: 'long' });
            const dayB = new Date(b.examdate).toLocaleString('en-US', { weekday: 'long' });
            
            if (dayA === focusDay && dayB !== focusDay) return -1;
            if (dayA !== focusDay && dayB === focusDay) return 1;
            return 0;
        });
        
        for (const exam of sortedExams) {
            if (processedExams.has(exam.examid)) continue;
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                const shuffled = this.shuffleArray([...availableObservers]);
                const head = shuffled[0];
                const secretary = shuffled[1];
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
            
            processedExams.add(exam.examid);
        }
        
        return chromosome;
    }
    /**
     * Validate and repair chromosome to ensure validity and uniqueness
     */
    validateAndRepairChromosome(chromosome, data) {
        // Create a map of exam assignments, keeping only the first occurrence of each exam
        const examMap = new Map();
        let duplicateCount = 0;
        
        // Process each gene and keep only the first occurrence of each exam
        for (const gene of chromosome) {
            if (!examMap.has(gene.examId)) {
                examMap.set(gene.examId, gene);
            } else {
                duplicateCount++;
            }
        }
        
        // Create a clean chromosome with exactly one gene per exam
        const cleanChromosome = [];
        for (const exam of data.exams) {
            const gene = examMap.get(exam.examid);
            if (gene) {
                cleanChromosome.push(gene);
            } else {
                // Add missing exam with null assignment
                cleanChromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
            }
        }
        
        // Now repair the chromosome to ensure all assignments are valid
        return this.repairChromosome(cleanChromosome, data);
    }
    /**
     * Repair chromosome to ensure validity
     */
    repairChromosome(chromosome, data) {
        const observerUsage = new Map();
        const repairedChromosome = [];
        
        // Process each gene in order
        for (const gene of chromosome) {
            const exam = data.exams.find(e => e.examid === gene.examId);
            if (!exam) {
                continue;
            }
            
            // Check if current assignment is valid
            const headAvailable = this.isObserverAvailable(
                gene.headId,
                exam,
                observerUsage,
                data
            );
            
            const secretaryAvailable = this.isObserverAvailable(
                gene.secretaryId,
                exam,
                observerUsage,
                data
            );
            
            if (headAvailable && secretaryAvailable && gene.headId !== gene.secretaryId) {
                // Valid assignment - keep it
                repairedChromosome.push(gene);
                this.updateObserverUsage(observerUsage, gene.headId, exam);
                this.updateObserverUsage(observerUsage, gene.secretaryId, exam);
            } else {
                // Need to find new assignment
                const availableObservers = this.getAvailableObserversForExam(
                    exam,
                    data.observers,
                    observerUsage,
                    data.conflicts
                );
                
                if (availableObservers.length >= 2) {
                    const shuffled = this.shuffleArray([...availableObservers]);
                    const newGene = {
                        examId: exam.examid,
                        headId: shuffled[0].observerid,
                        secretaryId: shuffled[1].observerid
                    };
                    repairedChromosome.push(newGene);
                    this.updateObserverUsage(observerUsage, newGene.headId, exam);
                    this.updateObserverUsage(observerUsage, newGene.secretaryId, exam);
                } else {
                    // No valid assignment possible
                    repairedChromosome.push({
                        examId: exam.examid,
                        headId: null,
                        secretaryId: null
                    });
                }
            }
        }
        
        return repairedChromosome;
    }
    /**
     * Check if observer is available for exam
     */
    isObserverAvailable(observerId, exam, currentUsage, data) {
        if (!observerId) return false;
        
        const observer = data.observers.find(o => o.observerid === observerId);
        if (!observer) return false;
        
        const examDate = new Date(exam.examdate);
        const examDay = examDate.toLocaleString('en-US', { weekday: 'long' });
        
        // Check availability type
        const availability = observer.availability ? observer.availability.toLowerCase() : 'full-time';
        
        // Full-time observers
        if (availability === 'full-time' || !observer.availability) {
            // Only check conflicts
            const observerExams = currentUsage.get(observer.observerid) || [];
            const hasCurrentConflict = observerExams.some(assignedExam => {
                const assignedDate = new Date(assignedExam.examdate);
                if (assignedDate.getTime() !== examDate.getTime()) return false;
                return (exam.starttime < assignedExam.endtime && exam.endtime > assignedExam.starttime);
            });
            
            if (hasCurrentConflict) return false;
            
            const hasExistingConflict = data.conflicts.some(conflict => {
                if (conflict.observerid !== observer.observerid) return false;
                const conflictDate = new Date(conflict.examdate);
                if (conflictDate.getTime() !== examDate.getTime()) return false;
                
                const conflictStart = conflict.starttime || conflict.startTime;
                const conflictEnd = conflict.endtime || conflict.endTime;
                return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
            });
            
            return !hasExistingConflict;
        }
        // Part-time observers
        else if (availability === 'part-time') {
            // Check time slots first
            const slots = observer.time_slots || [];
            if (slots.length === 0) return false;
            
            const hasMatchingSlot = slots.some(slot => {
                if (!slot) return false;
                
                const slotDay = slot.day ? slot.day.toLowerCase().trim() : '';
                const examDayLower = examDay.toLowerCase().trim();
                
                if (slotDay !== examDayLower) return false;
                
                const slotStart = slot.starttime || slot.startTime;
                const slotEnd = slot.endtime || slot.endTime;
                
                if (!slotStart || !slotEnd) return false;
                
                return slotStart <= exam.starttime && slotEnd >= exam.endtime;
            });
            
            if (!hasMatchingSlot) return false;
            
            // Then check conflicts
            const observerExams = currentUsage.get(observer.observerid) || [];
            const hasCurrentConflict = observerExams.some(assignedExam => {
                const assignedDate = new Date(assignedExam.examdate);
                if (assignedDate.getTime() !== examDate.getTime()) return false;
                return (exam.starttime < assignedExam.endtime && exam.endtime > assignedExam.starttime);
            });
            
            if (hasCurrentConflict) return false;
            
            const hasExistingConflict = data.conflicts.some(conflict => {
                if (conflict.observerid !== observer.observerid) return false;
                const conflictDate = new Date(conflict.examdate);
                if (conflictDate.getTime() !== examDate.getTime()) return false;
                
                const conflictStart = conflict.starttime || conflict.startTime;
                const conflictEnd = conflict.endtime || conflict.endTime;
                return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
            });
            
            return !hasExistingConflict;
        }
        
        return false;
    }

    /**
     * Apply the best solution to database
     */
    async applySolution(client, bestSolution, data) {
        const results = {
            successful: [],
            failed: [],
            performance: {
                algorithm: 'genetic',
                generations: this.generations,
                populationSize: this.populationSize,
                finalFitness: bestSolution.fitness,
                convergenceGeneration: this.performanceMetrics.generations.length
            }
        };
        
        // Clear existing assignments
        const examIds = data.exams.map(e => e.examid);
        await client.query(
            'DELETE FROM ExamAssignment WHERE ExamID = ANY($1)',
            [examIds]
        );
        
        await client.query(
            `UPDATE ExamSchedule 
             SET ExamHead = NULL, ExamSecretary = NULL, Status = 'unassigned'
             WHERE ExamID = ANY($1)`,
            [examIds]
        );
        
        // Use the already validated chromosome from the best solution
        const validatedChromosome = bestSolution.chromosome;
        console.log(`[GA] Validated chromosome has ${validatedChromosome.length} genes for ${data.exams.length} exams`);
        
        // DEBUG: Log the chromosome before applying to database
        const beforeApplyValid = validatedChromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length;
        console.log(`[GA DEBUG] Before applying to database: ${beforeApplyValid}/${data.exams.length} valid assignments (${(beforeApplyValid/data.exams.length*100).toFixed(1)}%)`);
        
        // Apply new assignments
        const assignmentInserts = [];
        const examUpdates = [];
        
        // Process each gene in the validated chromosome
        validatedChromosome.forEach((gene) => {
            const exam = data.exams.find(e => e.examid === gene.examId);
            if (!exam) {
                console.log(`[GA] Exam ${gene.examId} not found in data, skipping`);
                return;
            }
            
            if (gene.headId && gene.secretaryId && gene.headId !== gene.secretaryId) {
                // Validate that observers are different
                if (gene.headId === gene.secretaryId) {
                    console.log(`[GA] Skipping invalid assignment: same observer for head and secretary in exam ${gene.examId}`);
                    results.failed.push({
                        examId: gene.examId,
                        examName: exam.examname,
                        reason: 'Same observer assigned as head and secretary'
                    });
                    return;
                }
                
                // Add to batch arrays
                assignmentInserts.push(
                    [gene.examId, exam.scheduleid, gene.headId, 'head', 'active'],
                    [gene.examId, exam.scheduleid, gene.secretaryId, 'secretary', 'active']
                );
                
                examUpdates.push({
                    examId: gene.examId,
                    headId: gene.headId,
                    secretaryId: gene.secretaryId
                });
                
                const headObserver = data.observers.find(o => o.observerid === gene.headId);
                const secretaryObserver = data.observers.find(o => o.observerid === gene.secretaryId);
                
                results.successful.push({
                    examId: gene.examId,
                    examName: exam.examname,
                    head: headObserver?.name || 'Unknown',
                    secretary: secretaryObserver?.name || 'Unknown'
                });
            } else {
                results.failed.push({
                    examId: gene.examId,
                    examName: exam.examname,
                    reason: gene.headId && gene.secretaryId ? 'Same observer for head and secretary' : 'No valid assignment found'
                });
            }
        });
        
        console.log(`[GA] Final results: ${results.successful.length} successful, ${results.failed.length} failed out of ${data.exams.length} total exams`);
        
        // Execute batch inserts
        if (assignmentInserts.length > 0) {
            const insertQuery = `
                INSERT INTO ExamAssignment (ExamID, ScheduleID, ObserverID, Role, Status)
                VALUES ${assignmentInserts.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
            `;
            await client.query(insertQuery, assignmentInserts.flat());
        }
        
        // Update exam schedules
        if (examUpdates.length > 0) {
            const updateQuery = `
                UPDATE ExamSchedule
                SET 
                    Status = 'assigned',
                    ExamHead = CASE ExamID
                        ${examUpdates.map(u => `WHEN ${u.examId} THEN ${u.headId}`).join(' ')}
                    END,
                    ExamSecretary = CASE ExamID
                        ${examUpdates.map(u => `WHEN ${u.examId} THEN ${u.secretaryId}`).join(' ')}
                    END
                WHERE ExamID IN (${examUpdates.map(u => u.examId).join(', ')})
            `;
            await client.query(updateQuery);
        }
        
        return results;
    }

    /**
     * Save performance report
     */
    async savePerformanceReport(results, data) {
        try {
            const MetricsService = require('./metricsService');
            
            // Calculate execution time
            const executionTime = Date.now() - this.performanceMetrics.startTime;
            
            // Save metrics using central service
            await MetricsService.saveMetrics('genetic', results, data, {
                executionTime,
                populationSize: this.populationSize,
                generations: this.generations,
                mutationRate: this.mutationRate,
                crossoverRate: this.crossoverRate,
                elitismRate: this.elitismRate,
                finalFitness: results.performance.finalFitness,
                convergenceData: this.performanceMetrics.generations
            });
            
            console.log('GA performance metrics saved successfully');
        } catch (error) {
            console.error('Error saving GA performance report:', error);
        }
    }
    /**
     * Utility: Shuffle array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Standard mutation - makes small changes to the chromosome
     */
    applyStandardMutation(chromosome, data) {
        // Determine number of mutations based on chromosome length
        const mutationCount = Math.max(1, Math.floor(chromosome.length * 0.1));
        
        for (let i = 0; i < mutationCount; i++) {
            const examIndex = Math.floor(Math.random() * chromosome.length);
            const exam = data.exams[examIndex];
            
            // Build observer usage map excluding current exam
            const observerUsage = new Map();
            for (let j = 0; j < chromosome.length; j++) {
                if (j !== examIndex && chromosome[j].headId && chromosome[j].secretaryId) {
                    this.updateObserverUsage(observerUsage, chromosome[j].headId, data.exams[j]);
                    this.updateObserverUsage(observerUsage, chromosome[j].secretaryId, data.exams[j]);
                }
            }
            
            // Get available observers
            const availableObservers = this.getAvailableObserversForExam(
                exam,
                data.observers,
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Randomly decide whether to change head or secretary or both
                const changeType = Math.random();
                if (changeType < 0.4) { // 40% chance to change head
                    const newHead = availableObservers[Math.floor(Math.random() * availableObservers.length)];
                    chromosome[examIndex].headId = newHead.observerid;
                } else if (changeType < 0.8) { // 40% chance to change secretary
                    const newSecretary = availableObservers[Math.floor(Math.random() * availableObservers.length)];
                    chromosome[examIndex].secretaryId = newSecretary.observerid;
                } else { // 20% chance to change both
                    const shuffled = this.shuffleArray([...availableObservers]);
                    if (shuffled.length >= 2) {
                        chromosome[examIndex].headId = shuffled[0].observerid;
                        chromosome[examIndex].secretaryId = shuffled[1].observerid;
                    }
                }
            }
        }
    }

    /**
     * Block mutation - mutates a block of consecutive exams
     */
    applyBlockMutation(chromosome, data) {
        const blockSize = Math.floor(Math.random() * 5) + 2; // 2-6 exams
        const start = Math.floor(Math.random() * (chromosome.length - blockSize));
        const end = start + blockSize;
        
        // Build initial observer usage map excluding the block
        const observerUsage = new Map();
        for (let i = 0; i < chromosome.length; i++) {
            if (i < start || i >= end) {
                const gene = chromosome[i];
                if (gene.headId && gene.secretaryId) {
                    this.updateObserverUsage(observerUsage, gene.headId, data.exams[i]);
                    this.updateObserverUsage(observerUsage, gene.secretaryId, data.exams[i]);
                }
            }
        }
        
        // Reassign the block
        for (let i = start; i < end; i++) {
            const exam = data.exams[i];
            const availableObservers = this.getAvailableObserversForExam(
                exam,
                data.observers,
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                const shuffled = this.shuffleArray([...availableObservers]);
                chromosome[i] = {
                    examId: exam.examid,
                    headId: shuffled[0].observerid,
                    secretaryId: shuffled[1].observerid
                };
                
                this.updateObserverUsage(observerUsage, shuffled[0].observerid, exam);
                this.updateObserverUsage(observerUsage, shuffled[1].observerid, exam);
            }
        }
    }

    /**
     * Catastrophic mutation - completely reassigns a large portion of the chromosome
     */
    applyCatastrophicMutation(chromosome, data) {
        const segmentSize = Math.floor(chromosome.length * 0.3); // 30% of chromosome
        const start = Math.floor(Math.random() * (chromosome.length - segmentSize));
        
        // Clear the segment
        for (let i = start; i < start + segmentSize; i++) {
            chromosome[i] = {
                examId: data.exams[i].examid,
                headId: null,
                secretaryId: null
            };
        }
        
        // Build observer usage map excluding the segment
        const observerUsage = new Map();
        for (let i = 0; i < chromosome.length; i++) {
            if (i < start || i >= start + segmentSize) {
                const gene = chromosome[i];
                if (gene.headId && gene.secretaryId) {
                    this.updateObserverUsage(observerUsage, gene.headId, data.exams[i]);
                    this.updateObserverUsage(observerUsage, gene.secretaryId, data.exams[i]);
                }
            }
        }
        
        // Reassign using a different strategy
        for (let i = start; i < start + segmentSize; i++) {
            const exam = data.exams[i];
            const availableObservers = this.getAvailableObserversForExam(
                exam,
                data.observers,
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Use a different selection strategy for variety
                const headIndex = Math.floor(Math.random() * Math.min(3, availableObservers.length));
                const head = availableObservers[headIndex];
                
                const secretaryCandidates = availableObservers.filter(o => o.observerid !== head.observerid);
                const secretaryIndex = Math.floor(Math.random() * Math.min(2, secretaryCandidates.length));
                const secretary = secretaryCandidates[secretaryIndex];
                
                chromosome[i] = {
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                };
                
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
            }
        }
    }

    // Removed island model and complex restart mechanisms to simplify the algorithm

    /**
     * Apply local search to elite individuals in the population
     */
    applyLocalSearchToElite(population, data) {
        const eliteCount = Math.floor(this.populationSize * this.localSearchRate);
        const sortedPopulation = [...population].sort((a, b) => b.fitness - a.fitness);
        
        let totalImprovements = 0;
        let significantImprovements = 0;
        
        for (let i = 0; i < eliteCount; i++) {
            const originalFitness = sortedPopulation[i].fitness;
            sortedPopulation[i] = this.localSearch(sortedPopulation[i], data);
            
            const improvement = sortedPopulation[i].fitness - originalFitness;
            if (improvement > 0) {
                totalImprovements++;
                
                // Only log significant improvements (more than 0.01)
                if (improvement > 0.01) {
                    significantImprovements++;
                }
                
                this.performanceMetrics.localSearchImprovements.push({
                    generation: this.performanceMetrics.generations.length,
                    individualIndex: i,
                    improvement: improvement,
                    originalFitness: originalFitness,
                    newFitness: sortedPopulation[i].fitness
                });
            }
        }
        
                        // Only log significant improvements
                if (significantImprovements > 0) {
                    console.log(`[Local Search] Improved ${significantImprovements} individuals`);
                }
        
        return sortedPopulation;
    }
    /**
     * Local search to improve individual solutions
     */
    localSearch(individual, data) {
        let currentFitness = individual.fitness;
        let improved = true;
        let iterations = 0;
        
        while (improved && iterations < this.localSearchIterations) {
            improved = false;
            iterations++;
            
            // Generate neighbors (slightly different solutions)
            const neighbors = this.generateNeighbors(individual, data);
            
            // Try each neighbor
            for (const neighbor of neighbors) {
                const neighborFitness = this.calculateFitness(neighbor.chromosome, data);
                
                if (neighborFitness > currentFitness) {
                    individual = neighbor;
                    currentFitness = neighborFitness;
                    improved = true;
                    break; // Take first improvement (greedy)
                }
            }
        }
        
        return individual;
    }
    /**
     * Generate neighboring solutions for local search
     */
    generateNeighbors(individual, data) {
        const neighbors = [];
        const chromosome = individual.chromosome;
        
        // Generate neighbors using different mutation strategies
        // 1. Standard mutation
        for (let i = 0; i < 3; i++) {
            const mutatedChromosome = [...chromosome];
            this.applyStandardMutation(mutatedChromosome, data);
            neighbors.push({
                ...individual,
                chromosome: mutatedChromosome,
                isGreedy: false,
                strategy: 'local-search-standard'
            });
        }
        
        // 2. Block mutation
        for (let i = 0; i < 2; i++) {
            const mutatedChromosome = [...chromosome];
            this.applyBlockMutation(mutatedChromosome, data);
            neighbors.push({
                ...individual,
                chromosome: mutatedChromosome,
                isGreedy: false,
                strategy: 'local-search-block'
            });
        }
        
        // 3. Catastrophic mutation (less frequently)
        const mutatedChromosome = [...chromosome];
        this.applyCatastrophicMutation(mutatedChromosome, data);
        neighbors.push({
            ...individual,
            chromosome: mutatedChromosome,
            isGreedy: false,
            strategy: 'local-search-catastrophic'
        });
        
        // Try targeted observer changes
        for (let i = 0; i < chromosome.length; i++) {
            const exam = data.exams[i];
            const currentGene = chromosome[i];
            
            // Try changing head observer
            const availableHeads = this.getAvailableObserversForExam(exam, data.observers, new Map(), data.conflicts);
            for (const head of availableHeads.slice(0, 3)) {
                if (head.observerid !== currentGene.headId) {
                    const neighbor = this.createChangeNeighbor(chromosome, i, 'head', head.observerid, data);
                    neighbors.push(neighbor);
                }
            }
            
            // Try changing secretary observer
            for (const secretary of availableHeads.slice(0, 3)) {
                if (secretary.observerid !== currentGene.secretaryId) {
                    const neighbor = this.createChangeNeighbor(chromosome, i, 'secretary', secretary.observerid, data);
                    neighbors.push(neighbor);
                }
            }
        }
        
        return neighbors;
    }
    /**
     * Create a neighbor by swapping assignments between two exams
     */
    createSwapNeighbor(chromosome, exam1, exam2, data) {
        const neighbor = {
            chromosome: chromosome.map(gene => ({ ...gene })),
            fitness: 0
        };
        
        // Swap head observers
        const tempHead = neighbor.chromosome[exam1].headId;
        neighbor.chromosome[exam1].headId = neighbor.chromosome[exam2].headId;
        neighbor.chromosome[exam2].headId = tempHead;
        
        // Swap secretary observers
        const tempSecretary = neighbor.chromosome[exam1].secretaryId;
        neighbor.chromosome[exam1].secretaryId = neighbor.chromosome[exam2].secretaryId;
        neighbor.chromosome[exam2].secretaryId = tempSecretary;
        
        return neighbor;
    }
    /**
     * Create a neighbor by changing one observer assignment
     */
    createChangeNeighbor(chromosome, exam, role, newObserverId, data) {
        const neighbor = {
            chromosome: chromosome.map(gene => ({ ...gene })),
            fitness: 0
        };
        
        if (role === 'head') {
            neighbor.chromosome[exam].headId = newObserverId;
        } else {
            neighbor.chromosome[exam].secretaryId = newObserverId;
        }
        
        return neighbor;
    }
}

module.exports = GeneticAssignmentService; 