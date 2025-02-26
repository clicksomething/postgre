const { client } = require('../../database/db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const registerUser = async (req, res) => {
    const { name, email, phoneNum, password, role } = req.body;

    if (!name || !email || !phoneNum || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Check if email already exists
        const existingUser = await client.query(
            `SELECT * FROM UserInfo WHERE Email = $1`,
            [email]
        );

        // Validate role
        if (!['normal_user', 'admin', 'observer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into UserInfo table
        const userInfoResult = await client.query(
            `INSERT INTO UserInfo (Name, Email, PhoneNum, Password) 
             VALUES ($1, $2, $3, $4) RETURNING ID`,
            [name, email, phoneNum, hashedPassword]
        );

        const userInfoId = userInfoResult.rows[0].id;

        // Get RoleID from Roles table
        const roleResult = await client.query(
            `SELECT RoleID FROM Roles WHERE RoleName = $1`,
            [role]
        );

        if (roleResult.rows.length === 0) {
            throw new Error('Role not found');
        }

        const roleId = roleResult.rows[0].roleid;

        // Insert into AppUser table with role
        const userResult = await client.query(
            `INSERT INTO AppUser (U_ID, RoleID) 
             VALUES ($1, $2) RETURNING UserID`,
            [userInfoId, roleId]
        );

        res.status(201).json({ message: 'User registered successfully', userId: userResult.rows[0].UserID });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await client.query(
            `SELECT ui.ID, ui.Password, u.UserID, u.RoleID
            FROM UserInfo ui
            JOIN AppUser u ON ui.ID = u.U_ID
            WHERE ui.Email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Log the retrieved user data for debugging
        console.log('Retrieved user data:', user);

        // Ensure the hashed password exists
        if (!user.password) {
            console.error('Password not found for user:', user);
            return res.status(500).json({ message: 'User password not found' });
        }

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { userId: user.UserID, roleId: user.RoleID },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Return the token and user data
        return res.json({
            token,
            userId: user.UserID,
            roleId: user.RoleID,
            isAdmin: user.roleid === 2 // Ensure this matches the admin role ID
        });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

const validateToken = (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.status(200).json({ valid: true, user: decoded });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        res.status(403).json({ message: 'Invalid token' });
    }
};

module.exports = { 
    login,
    registerUser,
    validateToken
};

