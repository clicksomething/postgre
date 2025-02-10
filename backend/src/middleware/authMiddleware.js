const jwt = require('jsonwebtoken');
require('dotenv').config();
const { client } = require('../../database/db.js'); // Ensure the database client is imported

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

const getAdminRoleId = async () => {
    const result = await client.query(`SELECT RoleID FROM Roles WHERE RoleName = 'admin'`);
    return result.rows[0]?.RoleID; // Return the RoleID if found
};

const authorizeAdmin = async (req, res, next) => {
    if (!req.user || req.user.roleId !== await getAdminRoleId()) { // Ensure req.user exists before checking role
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

module.exports = { authenticateToken, authorizeAdmin };
