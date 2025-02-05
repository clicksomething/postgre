// index.js
const express = require('express');
const app = express();

// Import the user routes
const userRoutes = require('./src/routes/userRoutes');

// Use middleware to handle JSON requests
app.use(express.json());

// Use the user routes
app.use('/api/users', userRoutes);  // All user-related routes

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
