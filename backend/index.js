// index.js
const initDB = require('./database/initDB');
const express = require('express');
const app = express();

// Import the user routes
const userRoutes = require('./src/routes/userRoutes');

//Import the exam routes
const examRoutes = require('./src/routes/examRoutes');

// Use middleware to handle JSON requests
app.use(express.json());

initDB().then(() => {
  console.log('Database tables created successfully!');
}).catch((error) => {
  console.error('Error creating database tables:', error);
});
// Use the user routes
app.use('/api/users', userRoutes);  // All user-related routes

// Use the exam routes
app.use('/api/exams', examRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
