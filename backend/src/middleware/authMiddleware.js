const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', ''); // Handle "Bearer " prefix
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token' });
    }
};

const authorizeAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) { // Ensure req.user exists before checking isAdmin
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

module.exports = { authenticateToken, authorizeAdmin };
