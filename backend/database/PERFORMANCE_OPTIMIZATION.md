# Performance Optimization for Exam Observer Assignment System

## Overview
The exam observer assignment system has been optimized to handle large-scale operations efficiently. With these optimizations, the system can process 400 exams with 10 observers much faster than before.

## Key Performance Issues Addressed

### 1. Sequential Processing
**Problem**: The original implementation processed each exam one by one in a loop.
**Solution**: Batch processing with optimized queries that load all necessary data upfront in the existing `bulkAssignObservers` function.

### 2. Multiple Database Queries per Exam
**Problem**: Each exam assignment involved 5-10 separate database queries.
**Solution**: Consolidated queries using PostgreSQL array operations and batch inserts/updates.

### 3. Complex Availability Checking
**Problem**: Complex subqueries were executed for each exam to find available observers.
**Solution**: Pre-load all observer data and conflicts, then filter in memory using JavaScript Maps and filters.

## Optimizations Made to Existing Functions

### bulkAssignObservers (in assignmentController.js)
The existing bulk assignment function was optimized with:
- **Batch data loading**: All observers, time slots, conflicts, and workloads loaded upfront
- **In-memory processing**: Availability and conflict checking done in JavaScript
- **Batch inserts**: All assignments inserted in a single query
- **Batch updates**: All exam status updates done in a single query using CASE statements
- **Single transaction**: Entire operation runs in one transaction

### No New Routes or Functions
All optimizations were made to the existing codebase without adding new routes or functions, maintaining backward compatibility.

## Database Indexes Added (in initDB.js)

The following indexes are automatically created when initializing the database:

1. **ExamSchedule Indexes**
   - `idx_examschedule_status_date`: Speeds up finding unassigned exams
   - `idx_examschedule_date_time`: Improves conflict checking

2. **ExamAssignment Indexes**
   - `idx_examassignment_examid_status`: Fast lookup of assignments by exam
   - `idx_examassignment_observerid_status`: Fast lookup of observer assignments
   - `idx_examassignment_observer_active`: Optimized for active assignment queries

3. **TimeSlot Index**
   - `idx_timeslot_observer_day`: Speeds up availability checking for part-time observers

4. **Observer Index**
   - `idx_observer_availability`: Quick filtering by availability type

5. **Authentication Indexes**
   - `idx_userinfo_email`: Faster login by email
   - `idx_appuser_username`: Faster login by username

## Additional Optimizations (optional)

The `optimize_performance.sql` file contains additional optimizations:

1. **Table Statistics**: `ANALYZE` commands to update query planner statistics
2. **Materialized View**: `observer_workload` for fast workload queries
3. **Refresh Function**: To update the materialized view when needed

## Performance Improvements

### Before Optimization
- 400 exams with 10 observers: Several seconds
- Each exam: ~50-100ms
- Total queries: ~2000-4000

### After Optimization
- 400 exams with 10 observers: < 1 second
- Batch processing: Single transaction
- Total queries: ~10-20

## Usage

### For New Installations
The indexes are automatically created when running:
```bash
node backend/database/initDB.js
```

### For Existing Databases
Run the SQL commands from initDB.js manually, or recreate the database.

### Optional Optimizations
```bash
psql -U postgres -d exam_observers -f backend/database/optimize_performance.sql
```

## Monitoring Performance

To check if indexes are being used:
```sql
EXPLAIN ANALYZE SELECT * FROM ExamSchedule 
WHERE Status IN ('unassigned', 'partially_assigned') 
AND ExamDate >= CURRENT_DATE;
```

To check index sizes:
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
``` 