const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');

class GeneticAssignmentService {
    constructor(options = {}) {
        // GA parameters - Optimized for large datasets (895 exams, 167 observers)
        this.populationSize = options.populationSize || 150;  // Reduced from 300 for better performance
        this.generations = options.generations || 150;  // Reduced from 200
        this.baseMutationRate = options.mutationRate || 0.15;  // Reduced from 0.4 for stability
        this.mutationRate = this.baseMutationRate;
        this.crossoverRate = options.crossoverRate || 0.7;  // Reduced from 0.8
        this.elitismRate = options.elitismRate || 0.15;  // Increased from 0.1 to preserve good solutions
        this.tournamentSize = options.tournamentSize || 5;  // Reduced from 8 for faster selection
        
        // Mutation rate adaptation parameters - More conservative for large datasets
        this.minMutationRate = options.minMutationRate || 0.05;  // Reduced from 0.2
        this.maxMutationRate = options.maxMutationRate || 0.3;  // Reduced from 0.8
        
        // Add option for deterministic initialization
        this.useDeterministicInit = options.useDeterministicInit || true;  // Changed to true by default
        
        // Early convergence parameters - More lenient for large problems
        this.convergenceGenerations = options.convergenceGenerations || 30;  // Increased from 20
        this.convergenceThreshold = options.convergenceThreshold || 0.01;  // Increased from 0.005
        
        // Restart mechanism parameters - More conservative
        this.restartGenerations = options.restartGenerations || 80;  // Increased from 50
        this.restartThreshold = options.restartThreshold || 0.005;   // Increased from 0.001
        
        // Performance tracking - initialize without startTime
        this.performanceMetrics = {
            startTime: null,  // Will be set when assignment starts
            generations: [],
            bestFitness: 0,
            finalAssignments: 0,
            mutationRates: [] // Track mutation rate changes
        };


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
        return (0.7 * chromosomeDiversity + 0.3 * fitnessVariance);
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
        
        // Adjust mutation rate based on diversity and progress - Conservative for large datasets
        let newRate;
        if (diversity < 0.1) {
            // Very low diversity - moderate increase
            newRate = Math.min(this.mutationRate * 1.5, this.maxMutationRate);
        } else if (diversity < 0.2) {
            // Low diversity - slight increase
            newRate = Math.min(this.mutationRate * 1.3, this.maxMutationRate);
        } else if (diversity < 0.3) {
            // Moderate-low diversity - keep current rate
            newRate = this.mutationRate;
        } else if (diversity > 0.5) {
            // High diversity - reduce mutation
            newRate = Math.max(this.mutationRate * 0.9, this.minMutationRate);
        } else {
            // Moderate diversity - keep base rate
            newRate = this.baseMutationRate;
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
            diversity: diversity
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
            
            // 2. Initialize population
            let population = this.initializePopulation(data);
            console.log(`[GA] Initialized population with ${population.length} individuals`);
            
            // Track best fitness over generations for convergence detection
            let bestFitnessHistory = [];
            let bestOverallFitness = 0;
            let generationsWithoutImprovement = 0;
            let restartCount = 0;
            
            // Reset mutation rate to base rate
            this.mutationRate = this.baseMutationRate;
            
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
                    
                    // Reduce logging frequency for large datasets to improve performance
                    if (gen % 25 === 0) { // Changed from 10 to 25
                        console.log(`[GA] Generation ${gen}: Best Fitness = ${bestIndividual.fitness.toFixed(3)}, Avg Fitness = ${(population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length).toFixed(3)}`);
                    }
                
                // Check for early convergence
                if (bestIndividual.fitness === 1.0) {
                        console.log('[GA] Perfect solution found at generation', gen);
                    break;
                }
                    
                    // Check for fitness improvement convergence
                    if (gen >= this.convergenceGenerations) {
                        const recentFitness = bestFitnessHistory.slice(-this.convergenceGenerations);
                        const fitnessImprovement = Math.abs(recentFitness[recentFitness.length - 1] - recentFitness[0]);
                        
                        if (fitnessImprovement < this.convergenceThreshold && bestOverallFitness > 0.85) {
                            console.log('[GA] Converged at generation', gen, 'with fitness', bestOverallFitness);
                            break;
                        }
                    }
                    
                    // Check for restart condition
                    if (generationsWithoutImprovement >= this.restartGenerations && restartCount < 3) {
                        console.log(`[GA] Restarting population at generation ${gen} due to stagnation`);
                        restartCount++;
                        generationsWithoutImprovement = 0;
                        
                        // Keep best individual and regenerate rest of population
                        const bestIndividual = population.reduce((best, ind) => 
                            ind.fitness > best.fitness ? ind : best
                        );
                        
                        // Choose restart strategy based on initial population quality
                        let restartStrategy;
                        if (this.initialPopulationQuality < 0.6) {
                            // Poor initial quality - use aggressive random restart
                            restartStrategy = restartCount === 1 ? 'random-focus' : 'hybrid';
                            console.log(`[GA] Poor initial quality detected (${(this.initialPopulationQuality * 100).toFixed(1)}%), using aggressive restart`);
                        } else if (this.initialPopulationQuality < 0.8) {
                            // Moderate initial quality - try different strategies
                            restartStrategy = restartCount === 1 ? 'strategy-shift' : 'random-focus';
                            console.log(`[GA] Moderate initial quality detected (${(this.initialPopulationQuality * 100).toFixed(1)}%), using strategy shift`);
                        } else {
                            // Good initial quality - use hybrid approach
                            restartStrategy = restartCount === 1 ? 'hybrid' : 'strategy-shift';
                            console.log(`[GA] Good initial quality detected (${(this.initialPopulationQuality * 100).toFixed(1)}%), using hybrid restart`);
                        }
                        
                        population = this.createDiverseRestartPopulation(data, bestIndividual, restartStrategy);
                        
                        // Reset mutation rate to be more aggressive
                        this.mutationRate = this.maxMutationRate;
                        continue;
                    }
                
                // Create next generation
                population = this.evolvePopulation(population, data);
                } catch (genError) {
                    console.error('[GA] Error in generation', gen, ':', genError);
                    throw genError;
                }
            }
            
                    // 4. Get best solution
        const bestSolution = population.reduce((best, ind) => 
            ind.fitness > best.fitness ? ind : best
        );
        
        // DEBUG: Log the best solution before any processing
        const bestValidAssignments = bestSolution.chromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length;
        console.log(`[GA DEBUG] Best solution BEFORE processing: ${bestValidAssignments}/${data.exams.length} valid assignments (${(bestValidAssignments/data.exams.length*100).toFixed(1)}%)`);
        
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
        
        // DEBUG: Log the solution after duplicate removal
        const afterDuplicateRemoval = validatedChromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length;
        console.log(`[GA DEBUG] After duplicate removal: ${afterDuplicateRemoval}/${data.exams.length} valid assignments (${(afterDuplicateRemoval/data.exams.length*100).toFixed(1)}%)`);
        
        const validatedSolution = { ...bestSolution, chromosome: validatedChromosome };
        
        console.log(`[GA] Best solution found with fitness ${bestSolution.fitness}`);
        console.log(`[GA] Validated solution has ${validatedChromosome.filter(g => g.headId && g.secretaryId).length} valid assignments`);
            
                    // 5. Apply best solution to database
        const results = await this.applySolution(client, validatedSolution, data);
            console.log(`[GA] Applied solution: ${results.successful.length} successful, ${results.failed.length} failed`);
            
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
            // Strategy 1: Original greedy approach
            const greedyChromosome = this.createGreedyChromosome(data);
            const validatedGreedy = this.validateAndRepairChromosome(greedyChromosome, data);
            population.push({ chromosome: validatedGreedy, fitness: 0, isGreedy: true, strategy: 'greedy' });
            
            // Strategy 2: Workload-balanced greedy
            const workloadBalancedChromosome = this.createWorkloadBalancedChromosome(data);
            const validatedWorkload = this.validateAndRepairChromosome(workloadBalancedChromosome, data);
            population.push({ chromosome: validatedWorkload, fitness: 0, isGreedy: true, strategy: 'workload-balanced' });
            
            // Strategy 3: Constraint-aware greedy
            const constraintAwareChromosome = this.createConstraintAwareChromosome(data);
            const validatedConstraint = this.validateAndRepairChromosome(constraintAwareChromosome, data);
            population.push({ chromosome: validatedConstraint, fitness: 0, isGreedy: true, strategy: 'constraint-aware' });
            
            // Strategy 4: Qualification-optimized greedy
            const qualificationOptimizedChromosome = this.createQualificationOptimizedChromosome(data);
            const validatedQualification = this.validateAndRepairChromosome(qualificationOptimizedChromosome, data);
            population.push({ chromosome: validatedQualification, fitness: 0, isGreedy: true, strategy: 'qualification-optimized' });
            
            // Strategy 5: Time-slot optimized greedy (for part-time observers)
            const timeSlotOptimizedChromosome = this.createTimeSlotOptimizedChromosome(data);
            const validatedTimeSlot = this.validateAndRepairChromosome(timeSlotOptimizedChromosome, data);
            population.push({ chromosome: validatedTimeSlot, fitness: 0, isGreedy: true, strategy: 'time-slot-optimized' });
            
            // Add randomized variants of each strategy
            const strategies = [
                () => this.createGreedyChromosome(data, true),
                () => this.createWorkloadBalancedChromosome(data, true),
                () => this.createConstraintAwareChromosome(data, true),
                () => this.createQualificationOptimizedChromosome(data, true),
                () => this.createTimeSlotOptimizedChromosome(data, true)
            ];
            
            // Add 2-3 randomized variants of each strategy
            for (let i = 0; i < Math.min(3, Math.floor(this.populationSize * 0.02)); i++) {
                const strategyIndex = i % strategies.length;
                const variantChromosome = strategies[strategyIndex]();
                const validatedVariant = this.validateAndRepairChromosome(variantChromosome, data);
                population.push({ chromosome: validatedVariant, fitness: 0, isGreedy: true, strategy: `randomized-${strategyIndex}` });
            }
        }
        
        // Fill rest with improved random chromosomes
        while (population.length < this.populationSize) {
            const chromosome = this.createImprovedRandomChromosome(data);
            const validatedChromosome = this.validateAndRepairChromosome(chromosome, data);
            population.push({ chromosome: validatedChromosome, fitness: 0, isGreedy: false, strategy: 'improved-random' });
        }
        
        // Log validation statistics
        const validAssignments = population.map(p => 
            p.chromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length
        );
        const avgValidAssignments = validAssignments.reduce((a, b) => a + b, 0) / validAssignments.length;
        
        // Store initial population quality for restart decisions
        this.initialPopulationQuality = avgValidAssignments / data.exams.length;
        
        // Debug: Check a few chromosomes to see what's happening
        const sampleChromosomes = population.slice(0, 5);
        sampleChromosomes.forEach((ind, idx) => {
            const validCount = ind.chromosome.filter(g => g.headId && g.secretaryId && g.headId !== g.secretaryId).length;
            console.log(`[GA Debug] Sample chromosome ${idx} (${ind.strategy}): ${validCount}/${data.exams.length} valid assignments`);
        });
        
        console.log(`[GA] Initialized population with ${population.length} individuals using ${population.filter(p => p.isGreedy).length} greedy strategies`);
        console.log(`[GA] Average valid assignments per individual: ${avgValidAssignments.toFixed(1)} out of ${data.exams.length}`);
        console.log(`[GA] Initial population quality: ${(this.initialPopulationQuality * 100).toFixed(1)}%`);
        
        return population;
    }

    /**
     * Create a chromosome using greedy algorithm (deterministic)
     */
    createGreedyChromosome(data, addRandomization = false) {
        const chromosome = [];
        const observerUsage = new Map();
        const observerContinuity = new Map(); // Track last exam for each observer
        const processedExams = new Set(); // Track processed exams to prevent duplicates
        
        // Sort exams by date and time for consistent ordering
        const sortedExams = [...data.exams].sort((a, b) => {
            const dateCompare = new Date(a.examdate) - new Date(b.examdate);
            if (dateCompare !== 0) return dateCompare;
            return a.starttime.localeCompare(b.starttime);
        });
        
        // Calculate initial observer scores
        const observerScores = new Map();
        data.observers.forEach(observer => {
            // Base score starts at 1
            let score = 1;
            
            // Prefer observers with Dr. title for head position
            if (observer.title && observer.title.toLowerCase().includes('dr')) {
                score *= 1.2;
            }
            
            // Prefer full-time over part-time observers
            const availability = observer.availability ? observer.availability.toLowerCase() : 'full-time';
            if (availability === 'full-time') {
                score *= 1.1;
            }
            
            observerScores.set(observer.observerid, score);
        });
        
        for (let examIndex = 0; examIndex < sortedExams.length; examIndex++) {
            const exam = sortedExams[examIndex];
            
            // Skip if we've already processed this exam
            if (processedExams.has(exam.examid)) {
                continue;
            }
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Score available observers
                const scoredObservers = availableObservers.map(observer => {
                    let score = observerScores.get(observer.observerid) || 1;
                    const currentWorkload = observerUsage.get(observer.observerid)?.length || 0;
                    
                    // Penalize high workload
                    score /= (1 + currentWorkload * 0.2);
                    
                    // Bonus for continuity (if observer was in previous exam)
                    if (examIndex > 0) {
                        const prevExam = sortedExams[examIndex - 1];
                        const lastExamDate = observerContinuity.get(observer.observerid);
                        
                        if (lastExamDate && 
                            lastExamDate.date === exam.examdate &&
                            lastExamDate.endtime === exam.starttime) {
                            score *= 1.3; // 30% bonus for continuity
                        }
                    }
                    
                    return { observer, score };
                });
                
                // Sort by score (descending)
                scoredObservers.sort((a, b) => b.score - a.score);
                
                // Select head and secretary with optional randomization
                let head, secretary;
                if (addRandomization && scoredObservers.length > 2) {
                    // Add some randomization to selection
                    const headCandidates = scoredObservers.slice(0, Math.min(3, scoredObservers.length));
                    const headIndex = Math.floor(Math.random() * headCandidates.length);
                    head = headCandidates[headIndex].observer;
                } else {
                    head = scoredObservers[0].observer;
                }
                
                // Filter out head observer and resort for secretary selection
                const secretaryCandidates = scoredObservers
                    .filter(o => o.observer.observerid !== head.observerid)
                    .map(o => ({
                        observer: o.observer,
                        score: o.score * (o.observer.title?.toLowerCase().includes('dr') ? 0.9 : 1) // Slightly discourage using Dr. as secretary
                    }))
                    .sort((a, b) => b.score - a.score);
                
                if (addRandomization && secretaryCandidates.length > 2) {
                    const secCandidates = secretaryCandidates.slice(0, Math.min(3, secretaryCandidates.length));
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
                
                // Update usage tracking
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
                
                // Update continuity tracking
                observerContinuity.set(head.observerid, {
                    date: exam.examdate,
                    endtime: exam.endtime
                });
                observerContinuity.set(secretary.observerid, {
                    date: exam.examdate,
                    endtime: exam.endtime
                });
                
                // Mark exam as processed
                processedExams.add(exam.examid);
            } else {
                // No valid assignment
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
                
                // Mark exam as processed
                processedExams.add(exam.examid);
            }
        }
        
        return chromosome;
    }

    /**
     * Create a workload-balanced chromosome
     */
    createWorkloadBalancedChromosome(data, addRandomization = false) {
        const chromosome = [];
        const observerUsage = new Map();
        const observerWorkload = new Map();
        const processedExams = new Set(); // Track processed exams to prevent duplicates
        
        // Initialize workload tracking
        data.observers.forEach(observer => {
            observerWorkload.set(observer.observerid, 0);
        });
        
        // Sort exams by date and time
        const sortedExams = [...data.exams].sort((a, b) => {
            const dateCompare = new Date(a.examdate) - new Date(b.examdate);
            if (dateCompare !== 0) return dateCompare;
            return a.starttime.localeCompare(b.starttime);
        });
        
        for (const exam of sortedExams) {
            // Skip if we've already processed this exam
            if (processedExams.has(exam.examid)) {
                continue;
            }
            
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Score observers by workload balance
                const scoredObservers = availableObservers.map(observer => {
                    const currentWorkload = observerWorkload.get(observer.observerid) || 0;
                    const totalWorkload = observerUsage.get(observer.observerid)?.length || 0;
                    const totalLoad = currentWorkload + totalWorkload;
                    
                    // Prefer observers with lower workload
                    let score = 1 / (1 + totalLoad * 0.5);
                    
                    // Add some randomization if requested
                    if (addRandomization) {
                        score *= (0.8 + Math.random() * 0.4); // ±20% variation
                    }
                    
                    return { observer, score, workload: totalLoad };
                });
                
                // Sort by score (descending)
                scoredObservers.sort((a, b) => b.score - a.score);
                
                // Select head and secretary
                const head = scoredObservers[0].observer;
                const secretaryCandidates = scoredObservers
                    .filter(o => o.observer.observerid !== head.observerid)
                    .sort((a, b) => b.score - a.score);
                
                const secretary = secretaryCandidates[0].observer;
                
                chromosome.push({
                    examId: exam.examid,
                    headId: head.observerid,
                    secretaryId: secretary.observerid
                });
                
                // Update usage and workload
                this.updateObserverUsage(observerUsage, head.observerid, exam);
                this.updateObserverUsage(observerUsage, secretary.observerid, exam);
                observerWorkload.set(head.observerid, (observerWorkload.get(head.observerid) || 0) + 1);
                observerWorkload.set(secretary.observerid, (observerWorkload.get(secretary.observerid) || 0) + 1);
                
                // Mark exam as processed
                processedExams.add(exam.examid);
            } else {
                chromosome.push({
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                });
                
                // Mark exam as processed
                processedExams.add(exam.examid);
            }
        }
        
        return chromosome;
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
                // Score observers by their availability for this specific exam
                const scoredObservers = availableObservers.map(observer => {
                    let score = 1;
                    
                    // Check how many other exams this observer is already assigned to on the same day
                    const observerExams = observerUsage.get(observer.observerid) || [];
                    const sameDayExams = observerExams.filter(assignedExam => {
                        const assignedDate = new Date(assignedExam.examdate);
                        const examDate = new Date(exam.examdate);
                        return assignedDate.getTime() === examDate.getTime();
                    });
                    
                    // Prefer observers with fewer same-day assignments
                    score /= (1 + sameDayExams.length * 0.3);
                    
                    // Add randomization if requested
                    if (addRandomization) {
                        score *= (0.7 + Math.random() * 0.6); // ±30% variation
                    }
                    
                    return { observer, score };
                });
                
                scoredObservers.sort((a, b) => b.score - a.score);
                
                const head = scoredObservers[0].observer;
                const secretaryCandidates = scoredObservers
                    .filter(o => o.observer.observerid !== head.observerid)
                    .sort((a, b) => b.score - a.score);
                
                const secretary = secretaryCandidates[0].observer;
                
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
            o.title && o.title.toLowerCase().includes('dr')
        );
        const nonDrObservers = data.observers.filter(o => 
            !o.title || !o.title.toLowerCase().includes('dr')
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
                    o.title && o.title.toLowerCase().includes('dr')
                );
                const availableNonDr = availableObservers.filter(o => 
                    !o.title || !o.title.toLowerCase().includes('dr')
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
                    if (observer.title && observer.title.toLowerCase().includes('dr')) {
                        weight *= 1.3;
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
                    
                    // Convert time strings to comparable format (HH:mm)
                    const normalizeTime = (time) => {
                        if (!time) return null;
                        // If already in HH:mm format, return as is
                        if (/^\d{2}:\d{2}$/.test(time)) return time;
                        // If in HH:mm:ss format, remove seconds
                        if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.substring(0, 5);
                        return null;
                    };
                    
                    const slotStart = normalizeTime(slot.starttime || slot.startTime);
                    const slotEnd = normalizeTime(slot.endtime || slot.endTime);
                    const examStart = normalizeTime(exam.starttime);
                    const examEnd = normalizeTime(exam.endtime);
                    
                    if (!slotStart || !slotEnd || !examStart || !examEnd) return false;
                    
                    return slotStart <= examStart && slotEnd >= examEnd;
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
        
        // Debug: Log assignment info for first few chromosomes
        if (Math.random() < 0.01) { // Only log 1% of the time to avoid spam
            console.log(`[GA Debug] Chromosome has ${assignedCount}/${chromosome.length} valid assignments (${(assignmentScore * 100).toFixed(1)}%)`);
        }
        
        // PRIMARY: Make assignment coverage the dominant factor
        // A chromosome with 100% coverage should have fitness > 0.95
        score = assignmentScore * 0.95; // 95% of fitness comes from coverage
        
        // SECONDARY: Only consider other factors if we have good coverage
        if (assignmentScore > 0.5) {
            // 2. Workload balance (only 3% weight when coverage is good)
            const workloadMap = new Map();
            chromosome.forEach(gene => {
                if (gene.headId) {
                    workloadMap.set(gene.headId, (workloadMap.get(gene.headId) || 0) + 1);
                }
                if (gene.secretaryId) {
                    workloadMap.set(gene.secretaryId, (workloadMap.get(gene.secretaryId) || 0) + 1);
                }
            });
            
            const workloads = Array.from(workloadMap.values());
            const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length || 0;
            const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length || 0;
            const workloadScore = 1 / (1 + workloadVariance * 0.1); // Reduced impact
            
            // 3. Fairness (only 1% weight when coverage is good)
            let fairnessScore = 1;
            if (workloads.length > 0) {
                workloads.sort((a, b) => a - b);
                let sumOfDifferences = 0;
                let sumOfValues = workloads.reduce((a, b) => a + b, 0);
                
                for (let i = 0; i < workloads.length; i++) {
                    sumOfDifferences += (2 * (i + 1) - workloads.length - 1) * workloads[i];
                }
                
                const gini = sumOfValues > 0 ? Math.abs(sumOfDifferences / (workloads.length * sumOfValues)) : 0;
                fairnessScore = 1 - gini; // Lower Gini = higher fairness
            }
            
            // 4. Efficiency (only 1% weight when coverage is good)
            let efficiencyScore = 1;
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
                            efficiencyScore += 0.1;
                        }
                    }
                }
            }
            efficiencyScore = Math.min(efficiencyScore / chromosome.length, 1);
            
            // Add small bonuses for secondary factors
            score += 0.03 * workloadScore + 0.01 * fairnessScore + 0.01 * efficiencyScore;
        }
        
        // MASSIVE bonus for perfect or near-perfect coverage
        if (assignmentScore >= 0.99) {
            score = 1.0; // Perfect score for 99%+ coverage
        } else if (assignmentScore >= 0.95) {
            score = 0.98; // Very high score for 95%+ coverage
        } else if (assignmentScore >= 0.9) {
            score = 0.95; // High score for 90%+ coverage
        } else if (assignmentScore >= 0.8) {
            score = 0.9; // Good score for 80%+ coverage
        }
        
        // Severe penalty for very low assignment success
        if (assignmentScore < 0.1) {
            score *= 0.1; // 90% penalty for very low assignment success
        } else if (assignmentScore < 0.3) {
            score *= 0.3; // 70% penalty for low assignment success
        }
        
        return score;
    }

    /**
     * Evolve population to next generation
     */
    evolvePopulation(population, data) {
        const newPopulation = [];
        
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
                offspring1 = this.mutate(offspring1, data);
            }
            if (Math.random() < this.mutationRate) {
                offspring2 = this.mutate(offspring2, data);
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
            if (Math.random() < 0.5) {
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
     * Mutation operation - Enhanced with multiple mutation points
     */
    mutate(individual, data) {
        const chromosome = [...individual.chromosome];
        
        // For large datasets, use fewer mutation points to preserve good solutions
        const mutationCount = Math.max(1, Math.floor(this.mutationRate * chromosome.length * 0.2)); // Reduced from 0.5
        
        // Create mutation points - ensure they're unique
        const mutationPoints = new Set();
        while (mutationPoints.size < mutationCount) {
            const point = Math.floor(Math.random() * chromosome.length);
            mutationPoints.add(point);
        }
        
        // Apply mutations to each point
        for (const mutationPoint of mutationPoints) {
            const exam = data.exams[mutationPoint];
            
            // Get current assignment
            const currentGene = chromosome[mutationPoint];
            
            // Build usage map excluding current assignment - more efficient for large datasets
            const observerUsage = new Map();
            for (let idx = 0; idx < chromosome.length; idx++) {
                const gene = chromosome[idx];
                if (idx !== mutationPoint && gene.headId && gene.secretaryId) {
                    this.updateObserverUsage(observerUsage, gene.headId, data.exams[idx]);
                    this.updateObserverUsage(observerUsage, gene.secretaryId, data.exams[idx]);
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
                // For large datasets, prefer keeping one observer if possible
                if (currentGene.headId && availableObservers.some(o => o.observerid === currentGene.headId)) {
                    // Keep head, change secretary
                    const newSecretary = availableObservers.find(o => o.observerid !== currentGene.headId);
                    chromosome[mutationPoint] = {
                        examId: exam.examid,
                        headId: currentGene.headId,
                        secretaryId: newSecretary.observerid
                    };
                } else if (currentGene.secretaryId && availableObservers.some(o => o.observerid === currentGene.secretaryId)) {
                    // Keep secretary, change head
                    const newHead = availableObservers.find(o => o.observerid !== currentGene.secretaryId);
                    chromosome[mutationPoint] = {
                        examId: exam.examid,
                        headId: newHead.observerid,
                        secretaryId: currentGene.secretaryId
                    };
                } else {
                    // Both observers need to change
                    const shuffled = this.shuffleArray([...availableObservers]);
                    chromosome[mutationPoint] = {
                        examId: exam.examid,
                        headId: shuffled[0].observerid,
                        secretaryId: shuffled[1].observerid
                    };
                }
            } else {
                // No valid assignment
                chromosome[mutationPoint] = {
                    examId: exam.examid,
                    headId: null,
                    secretaryId: null
                };
            }
        }
        
        return {
            chromosome,
            fitness: 0
        };
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
                    const chromosome = this.createForceAssignmentChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-force-assign' 
                    });
                }
                
                // 2. Observer preference strategy - prioritize different observers
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.createObserverPreferenceChromosome(data, i % data.observers.length);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-observer-pref' 
                    });
                }
                
                // 3. Time-based strategy - focus on specific time slots
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.createTimeBasedChromosome(data, i % 24); // Different hours
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-time-based' 
                    });
                }
                
                // 4. Conflict-tolerant strategy - allow some conflicts
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.createConflictTolerantChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-conflict-tolerant' 
                    });
                }
                
                // 5. Fill rest with completely random
                while (population.length < populationSize) {
                    const chromosome = this.createCompletelyRandomChromosome(data);
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
                    const chromosome = this.createCompletelyRandomChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-completely-random' 
                    });
                }
                
                // 2. 30% random with observer rotation
                for (let i = 0; i < Math.floor(populationSize * 0.3); i++) {
                    const chromosome = this.createObserverRotationChromosome(data, i);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-observer-rotation' 
                    });
                }
                
                // 3. 20% random with time slot focus
                for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
                    const chromosome = this.createTimeSlotRandomChromosome(data, i);
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
                    const chromosome = this.createForceAssignmentChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-force' 
                    });
                }
                
                // 2. 25% conflict tolerant
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.createConflictTolerantChromosome(data);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-conflict' 
                    });
                }
                
                // 3. 25% observer preference
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.createObserverPreferenceChromosome(data, i % data.observers.length);
                    population.push({ 
                        chromosome, 
                        fitness: 0, 
                        isGreedy: false, 
                        strategy: 'restart-hybrid-pref' 
                    });
                }
                
                // 4. 25% completely random
                for (let i = 0; i < Math.floor(populationSize * 0.25); i++) {
                    const chromosome = this.createCompletelyRandomChromosome(data);
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
            const hourA = parseInt(a.starttime.split(':')[0]);
            const hourB = parseInt(b.starttime.split(':')[0]);
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
            const reportsDir = path.join(__dirname, '../../performance-reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ga-assignment-performance-${timestamp}.json`;
            const filepath = path.join(reportsDir, filename);
            
            // Prepare assignments array for quality metrics
            // Get the best solution's chromosome which contains the actual assignments
            const bestChromosome = this.performanceMetrics.bestSolution || results.performance.bestSolution;
            const assignments = data.exams.map((exam, idx) => {
                const successfulAssignment = results.successful.find(s => s.examId === exam.examid);
                if (successfulAssignment) {
                    // Find the actual observer IDs from the results
                    const headObserver = data.observers.find(o => o.name === successfulAssignment.head);
                    const secretaryObserver = data.observers.find(o => o.name === successfulAssignment.secretary);
                    return {
                        examId: exam.examid,
                        headId: headObserver?.observerid || null,
                        secretaryId: secretaryObserver?.observerid || null
                    };
                } else {
                    return {
                        examId: exam.examid,
                        headId: null,
                        secretaryId: null
                    };
                }
            });
            
            // Calculate quality metrics
            const qualityMetrics = AssignmentQualityMetrics.calculateMetrics(
                assignments,
                data.exams,
                data.observers
            );
            
            const report = {
                timestamp: new Date().toISOString(),
                algorithm: 'genetic',
                parameters: {
                    populationSize: this.populationSize,
                    generations: this.generations,
                    mutationRate: this.mutationRate,
                    crossoverRate: this.crossoverRate,
                    elitismRate: this.elitismRate
                },
                examCount: data.exams.length,
                observerCount: data.observers.length,
                successfulAssignments: results.successful.length,
                failedAssignments: results.failed.length,
                finalFitness: results.performance.finalFitness,
                convergenceData: this.performanceMetrics.generations,
                totalTimeMs: Date.now() - this.performanceMetrics.startTime,
                examsPerSecond: (data.exams.length / ((Date.now() - this.performanceMetrics.startTime) / 1000)).toFixed(2),
                qualityMetrics: qualityMetrics,
                results
            };
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            
            // Append to summary
            const summaryFile = path.join(reportsDir, 'performance-summary.jsonl');
            const summaryLine = JSON.stringify({
                timestamp: report.timestamp,
                algorithm: 'genetic',
                examCount: report.examCount,
                successRate: ((results.successful.length / data.exams.length) * 100).toFixed(1),
                fitness: results.performance.finalFitness.toFixed(3),
                totalTimeMs: report.totalTimeMs,
                examsPerSecond: report.examsPerSecond,
                qualityScore: qualityMetrics.overallScore.percentage.toFixed(1),
                qualityGrade: qualityMetrics.overallScore.grade
            }) + '\n';
            
            await fs.appendFile(summaryFile, summaryLine);
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
}

module.exports = GeneticAssignmentService; 