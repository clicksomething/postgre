// index.js
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const userRoutes = require('../backend/src/routes/userRoutes.js'); // Importing user routes
const { client } = require('../backend/database/db.js'); // Import the already established DB connection
const initDB = require('./database/initDB');

// Middleware to parse incoming JSON data
app.use(bodyParser.json());
//Import the exam routes
const examRoutes = require('./src/routes/examRoutes');
// Use middleware to handle JSON requests
app.use(express.json());


initDB().then(() => {
  console.log('Database tables created successfully!');
}).catch((error) => {
  console.error('Error creating database tables:', error);
  process.exit(1);  // Exit the application if the DB initialization fails
});


// Use the routes
app.use('/api', userRoutes); // Prefixed with /api for user and observer routes

// Basic route to test server
app.get('/', (req, res) => {
  res.send('Exam Observer API is running!');
});

// Use the exam routes
app.use('/api/exams', examRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Set up the server to listen on a specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown of the server
process.on('SIGINT', async () => {
  console.log('Closing server and database connection...');
  await client.end(); // Close the database connection
  process.exit(); // Exit the process
});
