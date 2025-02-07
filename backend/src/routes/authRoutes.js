const express = require('express');
const { registerUser, login } = require('../controllers/authController');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes (No authentication needed)
router.post('/register', registerUser);
router.post('/login', login);

// Protected Route Example (Requires Authentication)
router.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Access granted to protected route!' });
});

// Admin-Only Route Example (Requires Authentication & Admin Role)
router.get('/admin', authenticateToken, authorizeAdmin, (req, res) => {
    res.json({ message: 'Welcome Admin!' });
});

module.exports = router;
