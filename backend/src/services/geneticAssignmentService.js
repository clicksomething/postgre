const { client } = require('../../database/db');
const fs = require('fs').promises;
const path = require('path');
const AssignmentQualityMetrics = require('../utils/assignmentQualityMetrics');

class GeneticAssignmentService {
    constructor(options = {}) {
        // GA parameters
        this.populationSize = options.populationSize || 50;
        this.generations = options.generations || 100;
        this.mutationRate = options.mutationRate || 0.1;
        this.crossoverRate = options.crossoverRate || 0.7;
        this.elitismRate = options.elitismRate || 0.1;
        this.tournamentSize = options.tournamentSize || 5;
        
        // Add option for deterministic initialization
        this.useDeterministicInit = options.useDeterministicInit || false;
        
        // Performance tracking - initialize without startTime
        this.performanceMetrics = {
            startTime: null,  // Will be set when assignment starts
            generations: [],
            bestFitness: 0,
            finalAssignments: 0
        };
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
            
            // 2. Initialize population
            let population = this.initializePopulation(data);
            
            // 3. Evolution loop
            for (let gen = 0; gen < this.generations; gen++) {
                // Evaluate fitness
                population = this.evaluateFitness(population, data);
                
                // Find best individual
                const bestIndividual = population.reduce((best, ind) => 
                    ind.fitness > best.fitness ? ind : best
                );
                
                // Store progress
                this.performanceMetrics.generations.push({
                    generation: gen,
                    bestFitness: bestIndividual.fitness,
                    avgFitness: population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length
                });
                
                // Check for early convergence
                if (bestIndividual.fitness === 1.0) {
                    break;
                }
                
                // Create next generation
                population = this.evolvePopulation(population, data);
            }
            
            // 4. Get best solution
            const bestSolution = population.reduce((best, ind) => 
                ind.fitness > best.fitness ? ind : best
            );
            
            // 5. Apply best solution to database
            const results = await this.applySolution(client, bestSolution, data);
            
            await client.query('COMMIT');
            
            // Save performance report
            await this.savePerformanceReport(results, data);
            
            return results;
            
        } catch (error) {
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
        
        // If deterministic init is enabled, create first individual using greedy approach
        if (this.useDeterministicInit && this.populationSize > 0) {
            const greedyChromosome = this.createGreedyChromosome(data);
            population.push({ chromosome: greedyChromosome, fitness: 0, isGreedy: true });
        }
        
        // Fill rest with random chromosomes
        while (population.length < this.populationSize) {
            const chromosome = this.createRandomChromosome(data);
            population.push({ chromosome, fitness: 0, isGreedy: false });
        }
        
        return population;
    }

    /**
     * Create a chromosome using greedy algorithm (deterministic)
     */
    createGreedyChromosome(data) {
        const chromosome = [];
        const observerUsage = new Map();
        
        // Sort exams by date and time for consistent ordering
        const sortedExams = [...data.exams].sort((a, b) => {
            const dateCompare = new Date(a.examdate) - new Date(b.examdate);
            if (dateCompare !== 0) return dateCompare;
            return a.starttime.localeCompare(b.starttime);
        });
        
        for (const exam of sortedExams) {
            const availableObservers = this.getAvailableObserversForExam(
                exam, 
                data.observers, 
                observerUsage,
                data.conflicts
            );
            
            if (availableObservers.length >= 2) {
                // Sort by workload (ascending) for consistent selection
                const sorted = availableObservers.sort((a, b) => {
                    const aWorkload = (observerUsage.get(a.observerid) || []).length;
                    const bWorkload = (observerUsage.get(b.observerid) || []).length;
                    return aWorkload - bWorkload;
                });
                
                const head = sorted[0];
                const secretary = sorted[1];
                
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
            
            if (availability === 'full-time' || !observer.availability) {
                // Full-time observers are always available (only check conflicts)
            } else if (availability === 'part-time') {
                // Check time slots
                const slots = observer.time_slots || [];
                
                // If no time slots defined, assume not available
                if (slots.length === 0) {
                    return false;
                }
                
                const hasMatchingSlot = slots.some(slot => {
                    if (!slot) return false;
                    
                    const slotDay = slot.day ? slot.day.toLowerCase() : '';
                    const examDayLower = examDay.toLowerCase();
                    
                    if (slotDay !== examDayLower) {
                        return false;
                    }
                    
                    // Handle both camelCase and lowercase property names
                    const slotStart = slot.startTime || slot.starttime;
                    const slotEnd = slot.endTime || slot.endtime;
                    
                    if (!slotStart || !slotEnd) return false;
                    
                    const timeMatch = slotStart <= exam.starttime && slotEnd >= exam.endtime;
                    return timeMatch;
                });
                
                if (!hasMatchingSlot) return false;
            } else {
                // Unknown availability type
                return false;
            }
            
            // Check conflicts with current assignments (in-memory tracking)
            const observerExams = currentUsage.get(observer.observerid) || [];
            const hasConflict = observerExams.some(assignedExam => {
                if (assignedExam.examdate.getTime() !== examDate.getTime()) return false;
                return (exam.starttime < assignedExam.endtime && exam.endtime > assignedExam.starttime);
            });
            
            if (hasConflict) return false;
            
            // Check existing conflicts in database
            const existingConflict = existingConflicts.some(conflict => {
                if (conflict.observerid !== observer.observerid) return false;
                if (new Date(conflict.examdate).getTime() !== examDate.getTime()) return false;
                
                // Handle both camelCase and lowercase property names
                const conflictStart = conflict.startTime || conflict.starttime;
                const conflictEnd = conflict.endTime || conflict.endtime;
                return (exam.starttime < conflictEnd && exam.endtime > conflictStart);
            });
            
            return !existingConflict;
        });
        
        return availableObservers;
    }

    /**
     * Update observer usage tracking
     */
    updateObserverUsage(usageMap, observerId, exam) {
        if (!usageMap.has(observerId)) {
            usageMap.set(observerId, []);
        }
        usageMap.get(observerId).push({
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
        const weights = {
            assigned: 0.5,        // 50% weight for assignment coverage
            workload: 0.4,        // 40% weight for balanced workload
            efficiency: 0.1       // 10% weight for efficiency
        };
        
        // 1. Assignment coverage
        const assignedCount = chromosome.filter(gene => gene.headId && gene.secretaryId).length;
        const assignmentScore = assignedCount / chromosome.length;
        
        // 2. Workload balance
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
        const workloadScore = 1 / (1 + workloadVariance); // Lower variance = higher score
        
        // 3. Efficiency (minimize observer switching between consecutive exams)
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
        
        // Calculate weighted fitness
        score = weights.assigned * assignmentScore +
                weights.workload * workloadScore +
                weights.efficiency * efficiencyScore;
        
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
     * Crossover operation
     */
    crossover(parent1, parent2, data) {
        const crossoverPoint = Math.floor(Math.random() * parent1.chromosome.length);
        
        const offspring1Chromosome = [
            ...parent1.chromosome.slice(0, crossoverPoint),
            ...parent2.chromosome.slice(crossoverPoint)
        ];
        
        const offspring2Chromosome = [
            ...parent2.chromosome.slice(0, crossoverPoint),
            ...parent1.chromosome.slice(crossoverPoint)
        ];
        
        // Repair chromosomes to ensure validity
        const offspring1 = {
            chromosome: this.repairChromosome(offspring1Chromosome, data),
            fitness: 0
        };
        
        const offspring2 = {
            chromosome: this.repairChromosome(offspring2Chromosome, data),
            fitness: 0
        };
        
        return [offspring1, offspring2];
    }

    /**
     * Mutation operation
     */
    mutate(individual, data) {
        const chromosome = [...individual.chromosome];
        const mutationPoint = Math.floor(Math.random() * chromosome.length);
        const exam = data.exams[mutationPoint];
        
        // Get current assignment
        const currentGene = chromosome[mutationPoint];
        
        // Build usage map excluding current assignment
        const observerUsage = new Map();
        chromosome.forEach((gene, idx) => {
            if (idx !== mutationPoint && gene.headId && gene.secretaryId) {
                this.updateObserverUsage(observerUsage, gene.headId, data.exams[idx]);
                this.updateObserverUsage(observerUsage, gene.secretaryId, data.exams[idx]);
            }
        });
        
        // Get available observers
        const availableObservers = this.getAvailableObserversForExam(
            exam,
            data.observers,
            observerUsage,
            data.conflicts
        );
        
        if (availableObservers.length >= 2) {
            // Randomly select new observers
            const shuffled = this.shuffleArray([...availableObservers]);
            chromosome[mutationPoint] = {
                examId: exam.examid,
                headId: shuffled[0].observerid,
                secretaryId: shuffled[1].observerid
            };
        } else {
            // No valid assignment
            chromosome[mutationPoint] = {
                examId: exam.examid,
                headId: null,
                secretaryId: null
            };
        }
        
        return {
            chromosome,
            fitness: 0
        };
    }

    /**
     * Repair chromosome to ensure validity
     */
    repairChromosome(chromosome, data) {
        const observerUsage = new Map();
        const repairedChromosome = [];
        
        for (let i = 0; i < chromosome.length; i++) {
            const gene = chromosome[i];
            const exam = data.exams[i];
            
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
                // Valid assignment
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
                    // No valid assignment
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
        
        // Use same logic as getAvailableObserversForExam but for single observer
        const availableObservers = this.getAvailableObserversForExam(
            exam,
            [observer],
            currentUsage,
            data.conflicts
        );
        
        return availableObservers.length > 0;
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
        
        // Apply new assignments
        const assignmentInserts = [];
        const examUpdates = [];
        
        bestSolution.chromosome.forEach((gene, idx) => {
            const exam = data.exams[idx];
            
            if (gene.headId && gene.secretaryId) {
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
                    reason: 'No valid assignment found'
                });
            }
        });
        
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