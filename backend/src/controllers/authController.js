const { client } = require('../../database/db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const registerUser = async (req, res) => {
    const { name, email, phoneNum, password, role } = req.body; // Include role

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

        // Insert into UserInfo
        const userInfoResult = await client.query(
            `INSERT INTO UserInfo (Name, Email, PhoneNum, Password) 
             VALUES ($1, $2, $3, $4) RETURNING ID`,
            [name, email, phoneNum, hashedPassword]
        );

        const userInfoId = userInfoResult.rows[0].id;

        // Insert into AppUser table with role
        const userResult = await client.query(
            `INSERT INTO AppUser (U_ID, RoleID) 
             VALUES ($1, (SELECT RoleID FROM Roles WHERE RoleName = $2)) RETURNING UserID`,
            [userInfoId, role]
        );

        res.status(201).json({ message: 'User registered successfully', userId: userResult.rows[0].UserID });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const login = async (req, res) => {
    console.log('Login request received:', req.body); // Log the incoming request

    const { email, password } = req.body;
    try {
        const result = await client.query(
            `SELECT ui.ID, ui.Password, u.UserID, u.RoleID
            FROM UserInfo ui
            JOIN AppUser u ON ui.ID = u.U_ID
            WHERE ui.Email = $1`, [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];
        console.log('Retrieved user data:', user); // Log the retrieved user data for debugging

        console.log('Password being compared:', password); // Log the password for debugging
        console.log('Hashed password from DB:', user.Password); // Log the hashed password for debugging

        const isMatch = await bcrypt.compare(password, user.password); // Ensure correct field is used

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.UserID, roleId: user.RoleID },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, userId: user.UserID, roleId: user.RoleID });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message }); // Include error message in response
    }
};

module.exports = { 
    login,
    registerUser
};
