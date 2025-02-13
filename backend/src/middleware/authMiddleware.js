const jwt = require('jsonwebtoken');
require('dotenv').config();
const { client } = require('../../database/db.js');

let adminRoleId = null;

const getAdminRoleId = async () => {
    if (adminRoleId) return adminRoleId;
    try {
        const result = await client.query(`SELECT RoleID FROM Roles WHERE RoleName = 'admin'`);
        adminRoleId = result.rows[0]?.RoleID;
        return adminRoleId;
    } catch (err) {
        console.error('Database error:', err);
        throw new Error('Failed to fetch admin role ID');
    }
};

const authenticateToken = (req, res, next) => {
    console.log('Authenticating token...'); // Debugging log
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'Access denied' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        console.log('User verified:', req.user);
        next();
    } catch (err) {
        console.log('Token verification failed:', err);
        res.status(403).json({ message: 'Invalid token' });
    }
};

const authorizeAdmin = async (req, res, next) => {
    console.log('Authorizing admin...'); // Debugging log
    if (!req.user || req.user.roleId !== await getAdminRoleId()) {
        console.log('Access denied: User is not an admin');
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

module.exports = { authenticateToken, authorizeAdmin };