const { client } = require('../../database/db.js');  // Assuming client is the same for both users and observers

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Create a new user
const createUser = async (req, res) => {
  const { name, email, phoneNum, password, role } = req.body; // Include role

  // Check if name is provided
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  // Check if email is provided
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Check if phone number is provided
  if (!phoneNum) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Check if password is provided
  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
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

    // Insert user data into UserInfo
    const userInfoResult = await client.query(
      `INSERT INTO UserInfo (Name, Email, PhoneNum, Password) 
       VALUES ($1, $2, $3, $4) RETURNING ID`,
      [name, email, phoneNum, hashedPassword]
    );

    const userInfoId = userInfoResult.rows[0].id;

    // Insert user and associate with UserInfo (appuser)
    const userResult = await client.query(
      `INSERT INTO AppUser (U_ID, RoleID) 
       VALUES ($1, (SELECT RoleID FROM Roles WHERE RoleName = $2)) RETURNING UserID`,
      [userInfoId, role]
    );

    res.status(201).json({ message: 'User created successfully', userId: userResult.rows[0].UserID });
  } catch (err) {
    console.error('Error creating user:', err); // Log the specific error message
    res.status(500).json({ message: 'Error creating user', error: err.message }); // Include error message in response
  }
};

// Create a new observer
const createObserver = async (req, res) => {
  const { title, scientificRank, fatherName, availability, email, password, name, phoneNum } = req.body; // Include title

  // Check if email is provided
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Check if name is provided
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  // Check if phone number is provided
  if (!phoneNum) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Check if password is provided
  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert observer data into Observer
    const result = await client.query(
      `INSERT INTO Observer (Email, Password, Name, PhoneNum, Title, ScientificRank, FatherName, Availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ObserverID`,
      [email, hashedPassword, name, phoneNum, title, scientificRank, fatherName, availability]
    );

    res.status(201).json({ message: 'Observer created successfully', observerID: result.rows[0].ObserverID });
  } catch (err) {
    console.error('Error creating observer:', err);
    res.status(500).json({ message: 'Error creating observer' });
  }
};

// Get all users (with userInfo)
const getUsers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT u.UserID, ui.Name, ui.Email, ui.PhoneNum, u.RoleID
      FROM "appuser" u
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
      SELECT o.ObserverID, ui.Name, ui.Email, o.Title AS ObserverName, o.ScientificRank, o.FatherName, o.Availability, ts.StartTime, ts.EndTime, c.CourseName
      FROM Observer o
      LEFT JOIN UserInfo ui ON o.U_ID = ui.ID
      LEFT JOIN TimeSlot ts ON o.TimeSlotID = ts.TimeSlotID
      LEFT JOIN Course c ON o.CourseID = c.CourseID
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
      SELECT u.UserID, ui.Name, ui.Email, ui.PhoneNum, u.RoleID
      FROM "appuser" u
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
      SELECT o.ObserverID, ui.Name, ui.Email, o.Title AS ObserverName, o.ScientificRank, o.FatherName, o.Availability, ts.StartTime, ts.EndTime, c.CourseName
      FROM Observer o
      LEFT JOIN UserInfo ui ON o.U_ID = ui.ID
      LEFT JOIN TimeSlot ts ON o.TimeSlotID = ts.TimeSlotID
      LEFT JOIN Course c ON o.CourseID = c.CourseID
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
  const { name, email, phoneNum, password } = req.body;

  // Start building the query
let query = `UPDATE "userinfo" SET `;

  const values = [];
  let index = 1;
  let fieldsProvided = false;

  // Check which fields are provided and build the query
  if (name) {
    query += `Name = $${index++}, `;
    values.push(name);
    fieldsProvided = true;
  }
  if (email) {
    query += `Email = $${index++}, `;
    values.push(email);
    fieldsProvided = true;
  }
  if (phoneNum) {
    query += `PhoneNum = $${index++}, `;
    values.push(phoneNum);
    fieldsProvided = true;
  }
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    query += `Password = $${index++}, `;
    values.push(hashedPassword);
    fieldsProvided = true;
  }

  // If no fields were provided, return an error
  if (!fieldsProvided) {
    return res.status(400).json({ message: "No fields provided for update" });
  }

  // Remove the last comma and space
  query = query.slice(0, -2);
  query += ` WHERE ID = $${index} RETURNING ID`;
  values.push(id);

  try {
    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

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

  // Start building the query
  let query = `UPDATE Observer SET `;
  const values = [];
  let index = 1;
  let fieldsProvided = false;

  // Check which fields are provided and build the query
  if (userID) {
    query += `U_ID = $${index++}, `;
    values.push(userID);
    fieldsProvided = true;
  }
  if (timeSlotID) {
    query += `TimeSlotID = $${index++}, `;
    values.push(timeSlotID);
    fieldsProvided = true;
  }
  if (courseID) {
    query += `CourseID = $${index++}, `;
    values.push(courseID);
    fieldsProvided = true;
  }
  if (name) {
    query += `Name = $${index++}, `;
    values.push(name);
    fieldsProvided = true;
  }
  if (scientificRank) {
    query += `ScientificRank = $${index++}, `;
    values.push(scientificRank);
    fieldsProvided = true;
  }
  if (fatherName) {
    query += `FatherName = $${index++}, `;
    values.push(fatherName);
    fieldsProvided = true;
  }
  if (availability) {
    query += `Availability = $${index++}, `;
    values.push(availability);
    fieldsProvided = true;
  }

  // If no fields were provided, return an error
  if (!fieldsProvided) {
    return res.status(400).json({ message: "No fields provided for update" });
  }

  // Remove the last comma and space
  query = query.slice(0, -2);
  query += ` WHERE ObserverID = $${index} RETURNING ObserverID`;
  values.push(id);

  try {
    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    res.status(200).json({ message: 'Observer updated successfully', observerID: result.rows[0].ObserverID });
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
      DELETE FROM "appuser" WHERE UserID = $1 RETURNING UserID
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
