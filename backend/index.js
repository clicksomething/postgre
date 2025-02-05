require('dotenv').config();
const express = require('express');
const createTables = require('./database/initDB');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Default route
app.get('/', (req, res) => {
    res.send('Test Scheduling API is running...');
});

// Run database setup
createTables();

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
