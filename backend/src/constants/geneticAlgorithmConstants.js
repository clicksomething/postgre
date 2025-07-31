// Genetic Algorithm Constants
// Centralized configuration for genetic algorithm parameters

const GA_CONSTANTS = {
  // Default GA Parameters
  DEFAULT_MIN_MUTATION_RATE: 0.05,
  DEFAULT_MAX_MUTATION_RATE: 0.5,
  DEFAULT_CONVERGENCE_THRESHOLD: 0.005,
  DEFAULT_LOCAL_SEARCH_RATE: 0.2, // Apply to top 20% of population
  DEFAULT_LOCAL_SEARCH_ITERATIONS: 15,
  
  // Diversity and Convergence
  DIVERSITY_WEIGHTS: {
    CHROMOSOME: 0.7,
    FITNESS_VARIANCE: 0.3
  },
  
  STAGNATION_THRESHOLD: 0.001,
  CONVERGENCE_FITNESS_THRESHOLD: 0.85,
  PERFECT_FITNESS: 1.0,
  
  // Mutation Rate Adaptation
  MUTATION_ADAPTATION: {
    LOW_DIVERSITY_THRESHOLD: 0.1,
    MODERATE_DIVERSITY_THRESHOLD: 0.2,
    HIGH_DIVERSITY_THRESHOLD: 0.5,
    STAGNATION_MULTIPLIER: 2.0,
    HIGH_DIVERSITY_MULTIPLIER: 0.8,
    MODERATE_DIVERSITY_MULTIPLIER: 1.5,
    LATE_GENERATION_THRESHOLD: 0.7,
    LATE_GENERATION_MULTIPLIER: 1.1
  },
  
  // Chromosome Initialization Strategies
  INITIALIZATION: {
    DETERMINISTIC_POPULATION_RATIO: 0.03, // 3% deterministic variants
    MAX_DETERMINISTIC_VARIANTS: 5
  },
  
  // Observer Scoring
  OBSERVER_SCORING: {
    DR_TITLE_BONUS: 1.2,
    FULL_TIME_BONUS: 1.1,
    WORKLOAD_PENALTY_FACTOR: 0.2,
    CONTINUITY_BONUS: 1.3, // 30% bonus for continuity
    DR_SECRETARY_PENALTY: 0.9, // Slightly discourage Dr. as secretary
    WORKLOAD_BALANCED_PENALTY: 0.3,
    CONSTRAINT_AWARE_BONUS: 1.15,
    RANDOMIZATION_VARIANCE: 0.6 // ±30% variation
  },
  
  // Fitness Calculation
  FITNESS: {
    PRIMARY_COVERAGE_WEIGHT: 0.95,
    COVERAGE_THRESHOLD_FOR_BONUSES: 0.8,
    WORKLOAD_SCORE_WEIGHT: 0.03,
    FAIRNESS_SCORE_WEIGHT: 0.01,
    EFFICIENCY_SCORE_WEIGHT: 0.01,
    EFFICIENCY_BONUS_PER_CONTINUITY: 0.1,
    
    // Coverage Thresholds and Scores
    PERFECT_COVERAGE_THRESHOLD: 0.99,
    PERFECT_SCORE: 1.0,
    VERY_HIGH_COVERAGE_THRESHOLD: 0.95,
    VERY_HIGH_SCORE: 0.98,
    HIGH_COVERAGE_THRESHOLD: 0.9,
    HIGH_SCORE: 0.95,
    GOOD_COVERAGE_THRESHOLD: 0.8,
    GOOD_SCORE: 0.9,
    
    // Penalties
    VERY_LOW_COVERAGE_THRESHOLD: 0.1,
    VERY_LOW_PENALTY: 0.1, // 90% penalty
    LOW_COVERAGE_THRESHOLD: 0.3,
    LOW_PENALTY: 0.3 // 70% penalty
  },
  
  // Crossover
  CROSSOVER: {
    POSITION_SWAP_PROBABILITY: 0.5
  },
  
  // Mutation Strategies
  MUTATION: {
    STANDARD_MUTATION_PROBABILITY: 0.4,
    SWAP_MUTATION_PROBABILITY: 0.6,
    BLOCK_MUTATION_PROBABILITY: 0.75,
    CATASTROPHIC_MUTATION_PROBABILITY: 0.9,
    
    STANDARD_MUTATION_INTENSITY: 0.2,
    STAGNATION_MUTATION_INTENSITY: 0.4,
    MIN_MUTATION_COUNT: 1,
    STAGNATION_MIN_MUTATION_COUNT: 3,
    
    BLOCK_SIZE_MIN: 2,
    BLOCK_SIZE_MAX: 6,
    CATASTROPHIC_SEGMENT_RATIO: 0.3, // 30% of chromosome
    
    MAX_SWAP_COUNT: 3,
    LOCAL_SEARCH_MUTATION_RATE: 0.3 // Higher mutation rate for local search
  },
  
  // Population Management
  POPULATION: {
    DIVERSITY_INJECTION_RATIO: 0.2, // Replace 20% of population
    RESTART_STRATEGY_RATIOS: {
      STRATEGY_SHIFT: {
        FORCE_ASSIGNMENT: 0.2,
        OBSERVER_PREFERENCE: 0.2,
        TIME_BASED: 0.2,
        CONFLICT_TOLERANT: 0.2,
        COMPLETELY_RANDOM: 0.2
      },
      RANDOM_FOCUS: {
        COMPLETELY_RANDOM: 0.5,
        OBSERVER_ROTATION: 0.3,
        TIME_SLOT_RANDOM: 0.2
      },
      HYBRID: {
        FORCE_ASSIGNMENT: 0.25,
        CONFLICT_TOLERANT: 0.25,
        OBSERVER_PREFERENCE: 0.25,
        COMPLETELY_RANDOM: 0.25
      }
    }
  },
  
  // Local Search
  LOCAL_SEARCH: {
    NEIGHBOR_LIMIT: 10, // Limit to nearby exams
    MAX_HEAD_OPTIONS: 3,
    MAX_SECRETARY_OPTIONS: 3,
    SIGNIFICANT_IMPROVEMENT_THRESHOLD: 0.01
  },
  
  // Timeouts and Limits
  EXECUTION: {
    MAX_EXECUTION_TIME_MS: 30 * 60 * 1000, // 30 minutes
    MAX_WORKLOAD_NORMALIZATION: 10
  }
};

// Genetic Algorithm Strategy Names
const GA_STRATEGY_NAMES = {
  GREEDY: 'greedy',
  WORKLOAD_BALANCED: 'workload-balanced',
  CONSTRAINT_AWARE: 'constraint-aware',
  QUALIFICATION_OPTIMIZED: 'qualification-optimized',
  TIME_SLOT_OPTIMIZED: 'time-slot-optimized',
  IMPROVED_RANDOM: 'improved-random',
  COMPLETELY_RANDOM: 'completely-random',
  
  // Restart Strategies
  RESTART_FORCE_ASSIGN: 'restart-force-assign',
  RESTART_OBSERVER_PREF: 'restart-observer-pref',
  RESTART_TIME_BASED: 'restart-time-based',
  RESTART_CONFLICT_TOLERANT: 'restart-conflict-tolerant',
  RESTART_OBSERVER_ROTATION: 'restart-observer-rotation',
  RESTART_TIME_SLOT_RANDOM: 'restart-time-slot-random',
  
  // Diversity Injection
  DIVERSITY_INJECTION: 'diversity-injection'
};

// Mutation Strategy Names
const GA_MUTATION_TYPES = {
  STANDARD: 'standard',
  SWAP: 'swap',
  BLOCK: 'block',
  CATASTROPHIC: 'catastrophic',
  COMPLETE_RESET: 'complete-reset',
  INVERSION: 'inversion'
};

// Population Restart Types
const GA_RESTART_TYPES = {
  STRATEGY_SHIFT: 'strategy-shift',
  RANDOM_FOCUS: 'random-focus',
  HYBRID: 'hybrid'
};

module.exports = {
  GA_CONSTANTS,
  GA_STRATEGY_NAMES,
  GA_MUTATION_TYPES,
  GA_RESTART_TYPES
};