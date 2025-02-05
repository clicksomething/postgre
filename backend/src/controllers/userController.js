// src/controllers/userController.js
const bcrypt = require('bcrypt');
const client = require('../../database/db'); // Import your DB connection

// Create a new user
const createUser = async (req, res) => {
  const { name, email, phoneNum, password, isAdmin } = req.body;

  // 1. Validate email format (basic check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  // 2. Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    // 3. Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Set the isAdmin field to false if not provided (normal user by default)
    const adminStatus = isAdmin !== undefined ? isAdmin : false;

    // 5. Insert into the UserInfo table
    const result = await client.query(
      'INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phoneNum, hashedPassword]
    );

    const newUser = result.rows[0];  // The new user data

    // 6. Insert into AppUser table, with admin status (if applicable)
    if (adminStatus !== false) {
      await client.query(
        'INSERT INTO AppUser (U_ID, IsAdmin) VALUES ($1, $2)',
        [newUser.ID, adminStatus]
      );
    }

    res.status(201).json(newUser);  // Respond with the new user data
  } catch (error) {
    console.error('Error creating user:', error);  // Log the full error
    res.status(500).json({ message: 'Error creating user', error: error.message });  // Return error details
  }
};

// Get user profile by ID
const getUsers = async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM UserInfo');
    res.status(200).json(result.rows); // Return all users
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params; // Get ID from the URL parameter
  try {
    const result = await client.query('SELECT * FROM UserInfo WHERE ID = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(result.rows[0]); // Return the user data
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving user' });
  }
};


// Update user information (e.g., phone number, email)
const updateUser = async (req, res) => {
  const { id } = req.params; // Get ID from URL parameter
  const { name, email, phoneNum, password, isAdmin } = req.body;

  // Validate fields, similar to how you validated the POST request.

  try {
    // Optionally, you can check if the user exists first:
    const result = await client.query('SELECT * FROM UserInfo WHERE ID = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If password is updated, hash it again
    let hashedPassword = result.rows[0].password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10); // Hash the new password
    }

    // Update user data in the UserInfo table
    await client.query(
      'UPDATE UserInfo SET Name = $1, Email = $2, PhoneNum = $3, Password = $4 WHERE ID = $5',
      [name, email, phoneNum, hashedPassword, id]
    );

    // Optionally update the AppUser table (admin status)
    if (isAdmin !== undefined) {
      await client.query(
        'UPDATE AppUser SET IsAdmin = $1 WHERE U_ID = $2',
        [isAdmin, id]
      );
    }

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

// Delete user by ID
const deleteUser = async (req, res) => {
  const { id } = req.params; // Get ID from URL parameter

  try {
    // Check if the user exists before attempting to delete
    const result = await client.query('SELECT * FROM UserInfo WHERE ID = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user from both UserInfo and AppUser tables
    await client.query('DELETE FROM AppUser WHERE U_ID = $1', [id]);
    await client.query('DELETE FROM UserInfo WHERE ID = $1', [id]);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting user' });
  }
};


module.exports = {
  createUser,
  getUserById,
  getUsers,
  updateUser,
  deleteUser,
};
