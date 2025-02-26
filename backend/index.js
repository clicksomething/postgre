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

app.use((req, res, next) => {
    console.log('Incoming Request:', req.method, req.url);
    console.log('Headers:', req.headers);
    next();
});

// Route prefixes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/timeslots', timeSlotRouter);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Exam Observer API is running!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Initialize database and insert dummy data
async function initialize() {
    try {
        await initDB();
        console.log('Database tables created successfully!');
        await insertDummyData();
    } catch (err) {
        console.error('Error during initialization:', err);
        process.exit(1);
    }
}

initialize().then(() => {
    // Start server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Closing server and database connection...');
    await client.end();
    process.exit();
});

app.options('*', cors()); // Handle preflight requests for all routes
