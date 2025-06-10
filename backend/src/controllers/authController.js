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

        res.status(201).json({ message: 'User registered successfully', userId: userResult.rows[0].userid });
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
        // Log the login attempt
        console.log('Login Attempt:', {
            email,
            passwordLength: password.length
        });

        const result = await client.query(
            `SELECT ui.ID, ui.Password, ui.Email, u.UserID, u.RoleID, r.RoleName
            FROM UserInfo ui
            JOIN AppUser u ON ui.ID = u.U_ID
            JOIN Roles r ON u.RoleID = r.RoleID
            WHERE ui.Email = $1`,
            [email]
        );

        console.log('Database Query Results:', {
            rowCount: result.rows.length,
            userDetails: result.rows.map(row => ({
                id: row.id,
                email: row.email,
                passwordHash: row.password ? row.password.substring(0, 10) + '...' : 'NO HASH',
                roleId: row.roleid,
                roleName: row.rolename
            }))
        });

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

        // Detailed password comparison logging
        console.log('Password Comparison:', {
            inputPassword: password,
            inputPasswordLength: password.length,
            storedHashLength: user.password ? user.password.length : 'N/A',
            storedHashStart: user.password ? user.password.substring(0, 10) : 'N/A'
        });

        // Detailed bcrypt comparison
        try {
            console.log('Bcrypt Debugging:', {
                bcryptVersion: require('bcrypt').version,
                nodeVersion: process.version
            });

            // Manually hash the input password with the same method
            const manualHash = await bcrypt.hash(password, 10);
            
            console.log('Manual Hash Comparison:', {
                inputPasswordManualHash: manualHash,
                storedHash: user.password,
                manualHashLength: manualHash.length,
                storedHashLength: user.password.length,
                hashesEqual: manualHash === user.password
            });

            const passwordCompareStart = Date.now();
            const isPasswordValid = await bcrypt.compare(password, user.password);
            const passwordCompareTime = Date.now() - passwordCompareStart;

            console.log('Password Comparison Result:', {
                isValid: isPasswordValid,
                comparisonTime: `${passwordCompareTime}ms`
            });

            if (!isPasswordValid) {
                // Try alternative comparison methods
                console.log('Alternative Comparison Attempts:', {
                    directCompare: password === user.password,
                    trimmedCompare: password.trim() === user.password.trim()
                });

                return res.status(401).json({ message: 'Invalid email or password' });
            }
        } catch (compareError) {
            console.error('Bcrypt Compare Error:', compareError);
            return res.status(500).json({ message: 'Internal authentication error', error: compareError.message });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { userId: user.userid, roleId: user.roleid },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Return the token and user data
        return res.json({
            token,
            userId: user.userid,
            roleId: user.roleid,
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

