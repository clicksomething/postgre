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
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Token received:', token); // Log the token
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

const authorizeAdmin = async (req, res, next) => {
    if (req.user.roleId !== await getAdminRoleId()) {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

module.exports = { authenticateToken, authorizeAdmin };