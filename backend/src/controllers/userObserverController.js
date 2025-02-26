const { client } = require('../../database/db.js');  // Assuming client is the same for both users and observers

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Create a new user
const createUser = async (req, res) => {
  const { name, email, phonenum, password, role } = req.body;

  // Validate role - only allow internal user roles
  if (!['normal_user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be normal_user or admin' });
  }

  // Input validation
  if (!name || !email || !phonenum || !password) {
    return res.status(400).json({ 
      message: 'All fields (name, email, phone number, and password) are required' 
    });
  }

  try {
    // Start transaction
    await client.query('BEGIN');

    // Check if email already exists in ANY user table
    const existingUser = await client.query(
      `SELECT ui.Email 
       FROM UserInfo ui
       WHERE ui.Email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
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

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'User created successfully', 
      userId: userResult.rows[0].userid,
      userInfoId: userInfoId 
    });

  } catch (err) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error creating user:', err);
    res.status(500).json({ 
      message: 'Error creating user', 
      error: err.message 
    });
  }
};

// Create a new observer
const createObserver = async (req, res) => {
  const { title, scientificRank, fatherName, availability, email, password, name, phonenum } = req.body;

  try {
    // Start a transaction
    await client.query('BEGIN');

    // Check if email already exists in UserInfo
    const existingUser = await client.query(
      'SELECT * FROM UserInfo WHERE Email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // First, create the user in UserInfo
    const userInfoResult = await client.query(
      `INSERT INTO UserInfo (Name, Email, PhoneNum, Password)
       VALUES ($1, $2, $3, $4) RETURNING ID`,
      [name, email, phonenum, hashedPassword]
    );

    const userInfoId = userInfoResult.rows[0].id;

    // Then create the AppUser with observer role only
    const appUserResult = await client.query(
      `INSERT INTO AppUser (U_ID, RoleID)
       VALUES ($1, (SELECT RoleID FROM Roles WHERE RoleName = 'observer'))
       RETURNING UserID`,
      [userInfoId]
    );

    const appUserId = appUserResult.rows[0].userid;

    // Finally create the Observer
    const observerResult = await client.query(
      `INSERT INTO Observer (U_ID, Email, Password, Name, PhoneNum, Title, ScientificRank, FatherName, Availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ObserverID`,
      [appUserId, email, hashedPassword, name, phonenum, title, scientificRank, fatherName, availability]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Observer created successfully', 
      observerID: observerResult.rows[0].observerid 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating observer:', err);
    if (err.code === '23505') { // unique violation
      res.status(400).json({ message: 'User already exists' });
    } else {
      res.status(500).json({ message: 'Error creating observer', error: err.message });
    }
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
      JOIN Roles r ON u.RoleID = r.RoleID
      WHERE r.RoleName IN ('normal_user', 'admin')  -- Only get internal users
      GROUP BY ui.ID, ui.Name, ui.Email, ui.PhoneNum
    `);

    res.status(200).json(result.rows.map(user => {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phonenum: user.phonenum,
        role: user.roleid === 2 ? 'admin' : 'normal_user',
        isAdmin: user.roleid === 2
      };
    }));

  } catch (err) {
    console.error('Error retrieving users:', err);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};


// Get all observers with their role information
const getObservers = async (req, res) => {
  try {
    const result = await client.query(`
      SELECT 
        o.ObserverID, 
        o.Name,
        o.Email, 
        o.Title AS ObserverTitle, 
        o.ScientificRank, 
        o.FatherName, 
        o.Availability,
        au.UserID,
        r.RoleName,
        ts.TimeSlotID, 
        ts.StartTime, 
        ts.EndTime, 
        ts.Day
      FROM Observer o
      JOIN AppUser au ON o.U_ID = au.UserID
      JOIN Roles r ON au.RoleID = r.RoleID
      LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
      ORDER BY o.ObserverID, ts.Day
    `);

    // Group timeslots by observer
    const observers = result.rows.reduce((acc, row) => {
      const observerId = row.observerid;
      if (!acc[observerId]) {
        acc[observerId] = {
          observerID: row.observerid,
          userID: row.userid,
          role: row.rolename,
          name: row.name,
          email: row.email,
          title: row.observertitle,
          scientificRank: row.scientificrank,
          fatherName: row.fathername,
          availability: row.availability,
          timeslots: [],
        };
      }

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

    res.status(200).json(Object.values(observers));
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
      SELECT ui.ID, ui.Name, ui.Email, ui.PhoneNum, r.RoleName
      FROM UserInfo ui
      JOIN AppUser au ON ui.ID = au.U_ID
      JOIN Roles r ON au.RoleID = r.RoleID
      WHERE ui.ID = $1 AND r.RoleName IN ('normal_user', 'admin')
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phonenum: user.phonenum,
      role: user.rolename,
      isAdmin: user.rolename === 'admin'
    });
  } catch (err) {
    console.error('Error retrieving user:', err);
    res.status(500).json({ message: 'Error retrieving user' });
  }
};

// Get observer by ID
const getObserverById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await client.query(`
      SELECT 
        o.ObserverID, 
        o.Name,
        o.Email, 
        o.Title AS ObserverTitle, 
        o.ScientificRank, 
        o.FatherName, 
        o.Availability,
        au.UserID,
        r.RoleName,
        ts.TimeSlotID, 
        ts.StartTime, 
        ts.EndTime, 
        ts.Day
      FROM Observer o
      JOIN AppUser au ON o.U_ID = au.UserID
      JOIN Roles r ON au.RoleID = r.RoleID
      LEFT JOIN TimeSlot ts ON o.ObserverID = ts.ObserverID
      WHERE o.ObserverID = $1
      ORDER BY ts.Day
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Observer not found' });
    }

    // Format the response
    const observer = {
      observerID: result.rows[0].observerid,
      userID: result.rows[0].userid,
      role: result.rows[0].rolename,
      name: result.rows[0].name,
      email: result.rows[0].email,
      title: result.rows[0].observertitle,
      scientificRank: result.rows[0].scientificrank,
      fatherName: result.rows[0].fathername,
      availability: result.rows[0].availability,
      timeslots: result.rows
        .filter(row => row.timeslotid)
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

  try {
    // First check if the user is an internal user
    const userCheck = await client.query(`
      SELECT r.RoleName
      FROM AppUser au
      JOIN Roles r ON au.RoleID = r.RoleID
      WHERE au.U_ID = $1
    `, [id]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!['normal_user', 'admin'].includes(userCheck.rows[0].rolename)) {
      return res.status(400).json({ message: "Cannot update observer through this endpoint" });
    }

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
  const { name, email, phonenum, title, scientificRank, fatherName, availability } = req.body;

  let query = `UPDATE Observer SET `;
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
  if (title) {
    query += `Title = $${index++}, `;
    values.push(title);
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
    if (!['full-time', 'part-time'].includes(availability)) {
      return res.status(400).json({ message: 'Availability must be either full-time or part-time' });
    }
    query += `Availability = $${index++}, `;
    values.push(availability);
    fieldsProvided = true;
  }

  if (!fieldsProvided) {
    return res.status(400).json({ message: "No fields provided for update" });
  }

  // Remove the trailing comma and space
  query = query.slice(0, -2);
  query += ` WHERE ObserverID = $${index}`;
  values.push(id);

  try {
    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Observer not found" });
    }

    res.status(200).json({ message: "Observer updated successfully" });
  } catch (err) {
    console.error('Error updating observer:', err);
    if (err.message.includes('Cannot set observer to full-time')) {
      res.status(400).json({ message: err.message });
    } else {
      res.status(500).json({ message: 'Error updating observer' });
    }
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
