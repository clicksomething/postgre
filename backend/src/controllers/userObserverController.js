const { client } = require('../../database/db.js');  // Assuming client is the same for both users and observers

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Create a new user
const createUser = async (req, res) => {
  const { name, email, phonenum, password, role } = req.body; // Include role

  // Validate role
  if (!['normal_user', 'admin', 'observer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
  }

  // Check if name is provided
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  // Check if email is provided
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Check if phone number is provided
  if (!phonenum) {
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
      [name, email, phonenum, hashedPassword]
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
  const { title, scientificRank, fatherName, availability, email, password, name, phonenum } = req.body; // Include title

  // Check if email is provided
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Check if name is provided
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  // Check if phone number is provided
  if (!phonenum) {
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
      [email, hashedPassword, name, phonenum, title, scientificRank, fatherName, availability]
    );

    res.status(201).json({ message: 'Observer created successfully', observerID: result.rows[0].ObserverID });
  } catch (err) {
    console.error('Error creating observer:', err);
    res.status(500).json({ message: 'Error creating observer' });
  }
};

// Add a new time slot for an observer
const addTimeSlot = async (req, res) => {
  const { startTime, endTime, observerId, day } = req.body;

  // Validate input
  if (!startTime || !endTime || !observerId || !day) {
    return res.status(400).json({ message: 'Start time, end time, observer ID, and day are required' });
  }

  try {
    // Insert the new time slot into the TimeSlot table
    const result = await client.query(
      `INSERT INTO TimeSlot (StartTime, EndTime, ObserverID, Day) 
       VALUES ($1, $2, $3, $4) RETURNING TimeSlotID`,
      [startTime, endTime, observerId, day]
    );

    res.status(201).json({ message: 'Time slot added successfully', timeSlotId: result.rows[0].TimeSlotID });
  } catch (err) {
    console.error('Error adding time slot:', err);
    res.status(500).json({ message: 'Error adding time slot', error: err.message });
  }
};

// Get all users (with userInfo)

const getUsers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT ui.ID, ui.Name, ui.Email, ui.PhoneNum, MIN(u.RoleID) AS RoleID
      FROM "appuser" u
      JOIN UserInfo ui ON u.U_ID = ui.ID
      GROUP BY ui.ID, ui.Name, ui.Email, ui.PhoneNum
    `);

    res.status(200).json(result.rows.map(user => {
      const role = user.roleid === 2 ? 'admin' : 'normal_user'; // Determine role

      return {
        ...user,
        role: role, // Add the role property to the user object
        isAdmin: user.roleid === 2 // Indicate if the user is an admin based on RoleID
      };
    }));

  } catch (err) {
    console.error('Error retrieving users:', err);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};


// Get all observers (with userInfo and timeSlot info)
const getObservers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        o.ObserverID, 
        ui.Name, 
        ui.Email, 
        o.Title AS ObserverTitle, 
        o.ScientificRank, 
        o.FatherName, 
        o.Availability, 
        ts.TimeSlotID, 
        ts.StartTime, 
        ts.EndTime, 
        ts.Day,
        c.CourseName
      FROM Observer o
      LEFT JOIN UserInfo ui ON o.U_ID = ui.ID
      LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
      LEFT JOIN Course c ON o.CourseID = c.CourseID
      ORDER BY o.ObserverID, ts.Day
    `);

    // Group timeslots by observer
    const observers = result.rows.reduce((acc, row) => {
      const observerId = row.observerid;
      if (!acc[observerId]) {
        acc[observerId] = {
          observerID: row.observerid,
          name: row.name,
          email: row.email,
          title: row.observertitle,
          scientificRank: row.scientificrank,
          fatherName: row.fathername,
          availability: row.availability,
          courseName: row.coursename,
          timeslots: [],
        };
      }

      // Add timeslot data if it exists
      if (row.timeslotid) {
        acc[observerId].timeslots.push({
          timeSlotID: row.timeslotid,
          startTime: row.starttime,
          endTime: row.endtime,
          day: row.day,
        });
      }

      return acc;
    }, {});

    // Convert the grouped data into an array
    const response = Object.values(observers);

    res.status(200).json(response);
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
      SELECT 
        o.ObserverID, 
        ui.Name, 
        ui.Email, 
        o.Title AS ObserverTitle, 
        o.ScientificRank, 
        o.FatherName, 
        o.Availability, 
        ts.TimeSlotID, 
        ts.StartTime, 
        ts.EndTime, 
        ts.Day,
        c.CourseName
      FROM Observer o
      LEFT JOIN UserInfo ui ON o.U_ID = ui.ID
      LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
      LEFT JOIN Course c ON o.CourseID = c.CourseID
      WHERE o.ObserverID = $1
      ORDER BY ts.Day
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    // Group timeslots by observer
    const observer = {
      observerID: result.rows[0].observerid,
      name: result.rows[0].name,
      email: result.rows[0].email,
      title: result.rows[0].observertitle,
      scientificRank: result.rows[0].scientificrank,
      fatherName: result.rows[0].fathername,
      availability: result.rows[0].availability,
      courseName: result.rows[0].coursename,
      timeslots: result.rows
        .filter(row => row.timeslotid) // Filter out rows without timeslots
        .map(row => ({
          timeSlotID: row.timeslotid,
          startTime: row.starttime,
          endTime: row.endtime,
          day: row.day,
        })),
    };

    res.status(200).json(observer);
  } catch (err) {
    console.error('Error retrieving observer:', err);
    res.status(500).json({ message: 'Error retrieving observer' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, phonenum, password, role } = req.body;

  let query = `UPDATE userinfo SET `;

  const values = [];
  let index = 1;
  let fieldsProvided = false;

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
  if (phonenum) {
      query += `PhoneNum = $${index++}, `;
      values.push(phonenum);
      fieldsProvided = true;
  }
  if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `Password = $${index++}, `;
      values.push(hashedPassword);
      fieldsProvided = true;
  }

  if (!fieldsProvided) {
      return res.status(400).json({ message: "No fields provided for update" });
  }

  // Remove the trailing comma and space
  query = query.slice(0, -2);

  query += ` WHERE ID = $${index}`;
  values.push(id);

  try {
      const result = await client.query(query, values);

      if (result.rowCount === 0) {
          return res.status(404).json({ message: "User not found" });
      }

      // Update the role in AppUser table, ensuring it's a user
      const roleId = role === 'admin' ? 2 : 1; // Convert role to RoleID
      const updateUserQuery = `
          UPDATE AppUser
          SET RoleID = $1
          WHERE U_ID = $2
          AND UserID = (
              SELECT UserID
              FROM AppUser
              WHERE U_ID = $2
              ORDER BY UserID ASC
              LIMIT 1
          )
      `;
      await client.query(updateUserQuery, [roleId, id]);

      res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ message: 'Error updating user' });
  }
};

// Update an observer
const updateObserver = async (req, res) => {
  const { id } = req.params;
  const { userID, courseID, name, scientificRank, fatherName, availability } = req.body;

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

const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Validate the U_ID
  const uId = parseInt(id, 10);
  if (isNaN(uId)) {
    return res.status(400).json({ message: 'Invalid U_ID' });
  }

  console.log('Deleting user with U_ID:', uId); // Debugging line

  try {
    // Check if the user is an observer
    const roleResult = await client.query(
      `SELECT RoleID FROM "appuser" WHERE U_ID = $1`,
      [uId]
    );

    if (roleResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const roleId = roleResult.rows[0].roleid;
    console.log('User role ID:', roleId); // Debugging line

    if (roleId === 3) {
      // If the user is an observer
      return res.status(400).json({ message: 'Cannot delete an observer' });
    }

    // Delete from appuser table using U_ID
    await client.query(
      `DELETE FROM "appuser" WHERE U_ID = $1`,
      [uId]
    );

    // Delete from UserInfo table using U_ID
    await client.query(
      `DELETE FROM "userinfo" WHERE ID = $1`,
      [uId]
    );

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: `Error deleting user: ${err.message}` });
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
  addTimeSlot,
  getUsers,
  getObservers,
  getUserById,
  getObserverById,
  updateUser,
  updateObserver,
  deleteUser,
  deleteObserver
};
