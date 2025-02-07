const { client } = require('../../database/db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const registerUser = async (req, res) => {
    const { name, email, phoneNum, password, isAdmin } = req.body;
  
    if (!name || !email || !phoneNum || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      // Check if email already exists
      const existingUser = await client.query(
        `SELECT * FROM UserInfo WHERE Email = $1`,
        [email]
      );
  
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
  
      // Insert into AppUser table
      const userResult = await client.query(
        `INSERT INTO appuser (U_ID, IsAdmin) 
         VALUES ($1, $2) RETURNING UserID`,
        [userInfoId, isAdmin]
      );
  
      res.status(201).json({ message: 'User registered successfully', userId: userResult.rows[0].UserID });
  
    } catch (err) {
      console.error('Error registering user:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await client.query(
            `SELECT ui.ID, ui.Password, u.UserID, u.IsAdmin
            FROM UserInfo ui
            JOIN appuser u ON ui.ID = u.U_ID
            WHERE ui.Email = $1`, [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.userid, isAdmin: user.isadmin },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, userId: user.userid, isAdmin: user.isadmin });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { 
    login,
    registerUser
 };