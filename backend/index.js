// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { client } = require('../backend/database/db.js');
const initDB = require('./database/initDB');
const insertDummyData = require('./database/insertDummyData');

// Import routes
const userRoutes = require('./src/routes/userRoutes.js');
const timeSlotRouter = require('./src/routes/timeSlotRouter.js');
const authRoutes = require('./src/routes/authRoutes.js');
const examRoutes = require('./src/routes/examRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (order is important)
app.use(cors({
    origin: 'http://localhost:3001', // Allow requests from this origin
    credentials: true, // Allow credentials (e.g., cookies, authorization headers)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
}));
app.use(express.json());
app.use(bodyParser.json());

// Basic console logging instead of winston
const logger = {
    info: console.log,
    error: console.error,
    warn: console.warn
};

// Middleware for logging requests
app.use((req, res, next) => {
    const logEntry = `${req.method} ${req.url} - ${req.get('user-agent') || 'Unknown Agent'}`;
    console.log(logEntry);
    console.log('Request Headers:', req.headers);
    console.log('Request Body:', req.body);
    next();
});

// Route prefixes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/timeslots', timeSlotRouter);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);

// Log all registered routes
function logRoutes(app) {
    console.log('--- REGISTERED ROUTES ---');
    app._router.stack.forEach(function(r){
        if (r.route && r.route.path){
            console.log(`${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
        }
    });
    console.log('--- END REGISTERED ROUTES ---');
}

// Call this after setting up routes
logRoutes(app);

// Basic route
app.get('/', (req, res) => {
    res.send('Exam Observer API is running!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`Error stack: ${err.stack}`);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Initialize database and insert dummy data
async function initializeDatabase() {
    try {
        // Check if tables exist
        const tablesCheckQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE';
        `;
        const tablesResult = await client.query(tablesCheckQuery);

        // If no tables exist, create them
        if (tablesResult.rows.length === 0) {
            console.log('No tables found. Initializing database...');
            await initDB();
            console.log('Database tables created successfully!');
        }

        // Check if tables are empty
        const emptyTablesCheck = `
            SELECT schemaname, relname 
            FROM pg_stat_user_tables 
            WHERE n_live_tup = 0;
        `;
        const emptyTablesResult = await client.query(emptyTablesCheck);

        // If tables are empty, insert dummy data
        if (emptyTablesResult.rows.length > 0) {
            console.log('Some tables are empty. Inserting dummy data...');
            await insertDummyData();
            console.log('Dummy data inserted successfully!');
        }
    } catch (err) {
        console.error(`Error during database initialization: ${err}`);
        process.exit(1);
    }
}

// Start server
const server = app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Initialize database before fully starting the server
    try {
        await initializeDatabase();
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing server and database connection...');
    server.close(() => {
        client.end();
        process.exit(0);
    });
});

app.options('*', cors()); // Handle preflight requests for all routes
