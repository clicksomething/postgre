// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { client } = require('../backend/database/db.js');
const initDB = require('./database/initDB');

// Import routes
const userRoutes = require('./src/routes/userRoutes.js');
const timeSlotRouter = require('./src/routes/timeSlotRouter.js');
const authRoutes = require('./src/routes/authRoutes.js');
const examRoutes = require('./src/routes/examRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (order is important)
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Route prefixes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', timeSlotRouter);
app.use('/api/exams', examRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Exam Observer API is running!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Initialize database
initDB().then(() => {
  console.log('Database tables created successfully!');
}).catch((err) => {
  console.error('Error creating database tables:', err);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing server and database connection...');
  await client.end();
  process.exit();
});
