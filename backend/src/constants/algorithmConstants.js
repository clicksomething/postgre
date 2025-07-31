// Algorithm Constants
// Centralized configuration for all assignment algorithms

const ALGORITHM_CONSTANTS = {
  // Chunking Configuration
  CHUNK_SIZE: 50,
  CHUNKED_TIMEOUT_MS: 8000,
  
  // Linear Programming Timeouts
  PURE_LP_TIMEOUT_MS: 45000, // 45 seconds for full LP
  HEAD_LP_TIMEOUT_MS: 3000,   // 3 seconds for head-only LP
  
  // Validation Configuration
  VALIDATION_TIMEOUT_MS: 5000, // 5 second timeout
  VALIDATION_BATCH_SIZE: 1000, // Check timeout every N assignments
  
  // GLPK Solver Limits (to prevent hangs)
  MAX_GLPK_CONSTRAINTS: 6000,
  MAX_GLPK_VARIABLES: 900,
  
  // Problem Size Thresholds
  LARGE_PROBLEM_THRESHOLD: 30000,  // Observer * Exam threshold for switching algorithms
  MAX_EXAMS_FOR_PURE_LP: 100,     // Maximum exams for pure LP approach
  
  // Quality Thresholds
  OVERLAP_TOLERANCE_PERCENT: 0.05, // 5% overlap tolerance
  
  // Performance Configuration
  LOG_FLUSH_DELAY_MS: 50,
  GREEDY_FALLBACK_TIMEOUT_RATIO: 0.5, // Use half of main timeout for fallbacks
  
  // Assignment Limits
  DEFAULT_MAX_ASSIGNMENTS_PER_OBSERVER: 10,
  FAIRNESS_BUFFER: 1, // Extra assignments allowed for load balancing
  
  // Algorithm Selection Thresholds
  HYBRID_THRESHOLD_EXAMS: 50,      // Use hybrid above this many exams
  HYBRID_THRESHOLD_VARIABLES: 5000 // Use hybrid above this many variables
};

// Algorithm Names for Consistent Logging
const ALGORITHM_NAMES = {
  HYBRID: 'hybrid-lp-greedy',
  PURE_LP: 'pure-linear-programming',
  PURE_GREEDY: 'greedy-optimized',
  CHUNKED: 'chunked-hybrid',
  MAXIMUM_COVERAGE: 'maximum-coverage'
};

// Logging Prefixes for Consistent Format
const LOG_PREFIXES = {
  HYBRID: '[HYBRID]',
  CHUNKED: '[CHUNKED]',
  PURE_LP: '[PURE-LP]',
  GREEDY: '[GREEDY]',
  MAX_COVERAGE: '[MAX-COVERAGE]',
  GLPK: '[GLPK]',
  VALIDATION: '[VALIDATION]',
  ERROR: '[ERROR]',
  WARNING: '[WARNING]',
  INFO: '[INFO]'
};

// Error Codes for Consistent Error Handling
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NO_SOLUTION: 'NO_SOLUTION',
  INVALID_DATA: 'INVALID_DATA',
  GLPK_ERROR: 'GLPK_ERROR',
  INSUFFICIENT_OBSERVERS: 'INSUFFICIENT_OBSERVERS'
};

// Quality Metrics Thresholds
const QUALITY_THRESHOLDS = {
  EXCELLENT_COVERAGE: 0.95,   // 95%+ coverage
  GOOD_COVERAGE: 0.85,        // 85%+ coverage
  ACCEPTABLE_COVERAGE: 0.70,  // 70%+ coverage
  POOR_COVERAGE: 0.50         // Below 50% is poor
};

module.exports = {
  ALGORITHM_CONSTANTS,
  ALGORITHM_NAMES,
  LOG_PREFIXES,
  ERROR_CODES,
  QUALITY_THRESHOLDS
};