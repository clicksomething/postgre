const { client } = require('../../database/db.js');  // Assuming client is the same for both users and observers
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Create a new user
const createUser = async (req, res) => {
  const { name, email, phoneNum, password, isAdmin } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user data into UserInfo
    const userInfoResult = await client.query(
      `INSERT INTO UserInfo (Name, Email, PhoneNum, Password)
       VALUES ($1, $2, $3, $4) RETURNING ID`,
      [name, email, phoneNum, hashedPassword]
    );

    const userInfoId = userInfoResult.rows[0].id;

    // Insert user and associate with UserInfo (AppUser)
    const userResult = await client.query(
      `INSERT INTO appuser (U_ID, IsAdmin) 
       VALUES ($1, $2) RETURNING UserID`,
      [userInfoId, isAdmin]
    );

    res.status(201).json({ message: 'User created successfully', userId: userResult.rows[0].UserID });
  } catch (err) {
    console.error('Error creating user:', err); // Log the specific error message
    res.status(500).json({ message: 'Error creating user', error: err.message }); // Include error message in response
  }
};

// Create a new observer
const createObserver = async (req, res) => {
  const { userID, timeSlotID, courseID, name, scientificRank, fatherName, availability } = req.body;

  try {
    // Insert observer data into Observer
    const result = await client.query(
      `INSERT INTO Observer (U_ID, TimeSlotID, CourseID, Name, ScientificRank, FatherName, Availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ObserverID`,
      [userID, timeSlotID, courseID, name, scientificRank, fatherName, availability]
    );

    res.status(201).json({ observerID: result.rows[0].ObserverID });
  } catch (err) {
    console.error('Error creating observer:', err);
    res.status(500).json({ message: 'Error creating observer' });
  }
};

// Get all users (with userInfo)
const getUsers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT u.UserID, ui.Name, ui.Email, ui.PhoneNum, u.IsAdmin
      FROM "AppUser" u
      JOIN UserInfo ui ON u.U_ID = ui.ID
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving users:', err);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};

// Get all observers (with userInfo and timeSlot info)
const getObservers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT o.ObserverID, ui.Name, ui.Email, o.Name AS ObserverName, o.ScientificRank, o.FatherName, o.Availability, ts.StartTime, ts.EndTime, c.CourseName
      FROM Observer o
      JOIN UserInfo ui ON o.U_ID = ui.ID
      JOIN TimeSlot ts ON o.TimeSlotID = ts.TimeSlotID
      JOIN Course c ON o.CourseID = c.CourseID
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving observers:', err);
    res.status(500).json({ message: 'Error retrieving observers' });
  }
};

// Get a user by ID (with userInfo)
const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query(`
      SELECT u.UserID, ui.Name, ui.Email, ui.PhoneNum, u.IsAdmin
      FROM "AppUser" u
      JOIN UserInfo ui ON u.U_ID = ui.ID
      WHERE u.UserID = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user:', err);
    res.status(500).json({ message: 'Error retrieving user' });
  }
};

// Get an observer by ID (with userInfo and timeSlot info)
const getObserverById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query(`
      SELECT o.ObserverID, ui.Name, ui.Email, o.Name AS ObserverName, o.ScientificRank, o.FatherName, o.Availability, ts.StartTime, ts.EndTime, c.CourseName
      FROM Observer o
      JOIN UserInfo ui ON o.U_ID = ui.ID
      JOIN TimeSlot ts ON o.TimeSlotID = ts.TimeSlotID
      JOIN Course c ON o.CourseID = c.CourseID
      WHERE o.ObserverID = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving observer:', err);
    res.status(500).json({ message: 'Error retrieving observer' });
  }
};

// Update a user
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, phoneNum, password, isAdmin } = req.body;

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const result = await client.query(`
      UPDATE "AppUser" u
      SET IsAdmin = $1
      FROM UserInfo ui
      WHERE u.U_ID = ui.ID AND u.UserID = $2
      RETURNING u.UserID
    `, [isAdmin, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateUserInfo = await client.query(`
      UPDATE UserInfo
      SET Name = $1, Email = $2, PhoneNum = $3, Password = $4
      WHERE ID = (SELECT U_ID FROM "AppUser" WHERE UserID = $5)
    `, [name, email, phoneNum, hashedPassword, id]);

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Error updating user' });
  }
};

// Update an observer
const updateObserver = async (req, res) => {
  const { id } = req.params;
  const { userID, timeSlotID, courseID, name, scientificRank, fatherName, availability } = req.body;

  try {
    const result = await client.query(`
      UPDATE Observer
      SET U_ID = $1, TimeSlotID = $2, CourseID = $3, Name = $4, ScientificRank = $5, FatherName = $6, Availability = $7
      WHERE ObserverID = $8
      RETURNING ObserverID
    `, [userID, timeSlotID, courseID, name, scientificRank, fatherName, availability, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    res.status(200).json({ message: 'Observer updated successfully' });
  } catch (err) {
    console.error('Error updating observer:', err);
    res.status(500).json({ message: 'Error updating observer' });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query(`
      DELETE FROM "AppUser" WHERE UserID = $1 RETURNING UserID
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

// Delete an observer
const deleteObserver = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query(`
      DELETE FROM Observer WHERE ObserverID = $1 RETURNING ObserverID
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    res.status(200).json({ message: 'Observer deleted successfully' });
  } catch (err) {
    console.error('Error deleting observer:', err);
    res.status(500).json({ message: 'Error deleting observer' });
  }
};

module.exports = {
  createUser,
  createObserver,
  getUsers,
  getObservers,
  getUserById,
  getObserverById,
  updateUser,
  updateObserver,
  deleteUser,
  deleteObserver
};
