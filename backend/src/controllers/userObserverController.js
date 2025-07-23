const { client } = require('../../database/db.js');  // Assuming client is the same for both users and observers

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// Add this code near the top of controllers/userObserverController.js

const multer = require('multer');
const xlsx = require('xlsx');
const crypto = require('crypto');
const { parseTimeSlot, validateAndFormatTime } = require('../utils/timeSlotParser');
const { smartTranslate } = require('../utils/translationService');

const fileFilter = (req, file, cb) => {
  // Mimetypes for Excel files (.xlsx, .xls)
  if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
  ) {
      cb(null, true); // Accept the file
  } else {
      // Reject other files
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
  }
};


const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
}).array('files', 10); // Allow up to 10 files

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
      LEFT JOIN timeslot ts ON o.ObserverID = ts.ObserverID
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
      LEFT JOIN timeslot ts ON o.ObserverID = ts.ObserverID
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
    // Start a transaction
    await client.query('BEGIN');

    // 1. Find the associated AppUser and UserInfo IDs
    const userInfoResult = await client.query(`
      SELECT o.u_id as user_info_id, o.u_id as app_user_id
      FROM observer o
      WHERE o.observerid = $1
    `, [id]);

    if (userInfoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Observer not found' });
    }

    const { user_info_id, app_user_id } = userInfoResult.rows[0];

    // 2. Remove the observer from ExamAssignment
    await client.query(`
      DELETE FROM examassignment 
      WHERE observerid = $1
    `, [id]);

    // 3. Update ExamSchedule to remove references to this observer
    await client.query(`
      UPDATE examschedule 
      SET examhead = NULL, 
          examsecretary = NULL, 
          status = 'unassigned'
      WHERE examhead = $1 OR examsecretary = $1
    `, [id]);

    // 4. Delete associated TimeSlots
    await client.query(`
      DELETE FROM timeslot
      WHERE observerid = $1
    `, [id]);

    // 5. Delete associated Preferences
    await client.query(`
      DELETE FROM preferences
      WHERE observerid = $1
    `, [id]);

    // 6. Delete the observer
    await client.query(`
      DELETE FROM observer WHERE observerid = $1
    `, [id]);

    // 7. Delete the AppUser 
    await client.query(`
      DELETE FROM appuser 
      WHERE userid = $1
    `, [user_info_id]);
    
    // 8. Delete the UserInfo
    await client.query(`
      DELETE FROM userinfo 
      WHERE id = $1
    `, [user_info_id]);

    // Commit the transaction
    await client.query('COMMIT');

    res.status(200).json({ 
      message: 'Observer and all associated records deleted successfully',
      details: {
        observerId: id,
        userInfoId: user_info_id,
        appUserId: app_user_id
      }
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error deleting observer:', err);
    res.status(500).json({ 
      message: 'Error deleting observer', 
      error: err.message,
      details: err
    });
  }
};

// Bulk delete observers
const bulkDeleteObservers = async (req, res) => {
  const { observerIds } = req.body;
  if (!Array.isArray(observerIds) || observerIds.length === 0) {
    return res.status(400).json({ message: 'observerIds must be a non-empty array' });
  }

  const deleted = [];
  const errors = [];
  const client = require('../../database/db').client;

  try {
    await client.query('BEGIN');
    for (const id of observerIds) {
      try {
        // 1. Find the associated AppUser and UserInfo IDs
        const userInfoResult = await client.query(`
          SELECT o.u_id as user_info_id, o.u_id as app_user_id
          FROM observer o
          WHERE o.observerid = $1
        `, [id]);

        if (userInfoResult.rows.length === 0) {
          errors.push({ id, error: 'Observer not found' });
          continue;
        }

        const { user_info_id, app_user_id } = userInfoResult.rows[0];

        // 2. Remove the observer from ExamAssignment
        await client.query(`
          DELETE FROM examassignment 
          WHERE observerid = $1
        `, [id]);

        // 3. Update ExamSchedule to remove references to this observer
        await client.query(`
          UPDATE examschedule 
          SET examhead = NULL, 
              examsecretary = NULL, 
              status = 'unassigned'
          WHERE examhead = $1 OR examsecretary = $1
        `, [id]);

        // 4. Delete associated TimeSlots
        await client.query(`
          DELETE FROM timeslot
          WHERE observerid = $1
        `, [id]);

        // 5. Delete associated Preferences
        await client.query(`
          DELETE FROM preferences
          WHERE observerid = $1
        `, [id]);

        // 6. Delete the observer
        await client.query(`
          DELETE FROM observer WHERE observerid = $1
        `, [id]);

        // 7. Delete the AppUser 
        await client.query(`
          DELETE FROM appuser 
          WHERE userid = $1
        `, [user_info_id]);
        
        // 8. Delete the UserInfo
        await client.query(`
          DELETE FROM userinfo 
          WHERE id = $1
        `, [user_info_id]);

        deleted.push(id);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }
    await client.query('COMMIT');
    res.status(200).json({ message: 'Bulk observer deletion complete', deleted, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Bulk deletion failed', error: err.message });
  }
};

const uploadObservers = async (req, res) => {
    console.log('--- UPLOAD OBSERVERS START ---');
    console.log('Request User:', req.user);
    console.log('Request Headers:', req.headers);
    console.log('Request Files:', req.files);

    if (!req.files || req.files.length === 0) {
        console.log('No files uploaded');
        return res.status(400).json({ message: "No Excel files uploaded." });
    }

    const overallSummary = {
        totalFiles: req.files.length,
        filesProcessed: 0,
        filesSuccessful: 0,
        filesFailed: 0,
        totalObserversCreated: 0,
        totalTimeSlotsCreated: 0,
        totalObserversSkipped: 0,
        fileResults: [],
        errors: [],
        parseErrors: [],
    };

    try {

        const roleResult = await client.query(`SELECT "roleid" FROM "roles" WHERE "rolename" = 'observer'`);
        const observerRoleId = roleResult.rows[0]?.roleid;
        if (!observerRoleId) throw new Error("The 'observer' role was not found.");

        // Process each file sequentially
        for (const [fileIndex, file] of req.files.entries()) {
            console.log(`--- PROCESSING FILE ${fileIndex + 1}/${req.files.length}: ${file.originalname} ---`);
            
            const fileSummary = {
                fileName: file.originalname,
                observersCreated: 0,
                timeSlotsCreated: 0,
                observersSkipped: 0,
                errors: [],
                parseErrors: [],
                status: 'processing'
            };

            try {
                const workbook = xlsx.read(file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    throw new Error("The uploaded Excel file contains no sheets.");
                }
                
                const results = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

                console.log(`--- FILE ${fileIndex + 1} EXCEL DATA ---`);
                console.log(JSON.stringify(results, null, 2));
                console.log("-----------------------");

                // Validate input before processing
                if (results.length === 0) {
                    throw new Error("The uploaded Excel file is empty.");
                }

        // Comprehensive mapping for titles and scientific ranks
        const titleMappings = {
            // Arabic to English with "ال" prefix
            'الدكتور': 'Dr.',
            'الدكتورة': 'Dr.',
            'الأستاذ الدكتور': 'Dr.',
            'الأستاذة الدكتورة': 'Dr.',

            // Without "ال" prefix
            'دكتور': 'Dr.',
            'دكتورة': 'Dr.',
            'استاذ دكتور': 'Dr.',
            'أستاذة دكتورة': 'Dr.',

            // Engineer titles
            'مهندس': 'Eng.',
            'مهندسة': 'Eng.',

            // Existing English options
            'Dr.': 'Dr.',
            'Prof.': 'Prof.',
            'Assoc. Prof.': 'Assoc. Prof.',
            'Assist. Prof.': 'Assist. Prof.',
            'Mr.': 'Mr.',
            'Mrs.': 'Mrs.',
            'Ms.': 'Ms.',
            'Eng.': 'Eng.',
        };

        const scientificRankMappings = {
            // Arabic to English mappings
            'مدرس': 'Lecturer',
            'مدرس مساعد': 'Assistant Lecturer',
            'أستاذ مساعد': 'Assistant Professor',
            'أستاذ مشارك': 'Associate Professor',
            'أستاذ': 'Professor',
            'محاضر': 'Lecturer',
            'محاضر مساعد': 'Assistant Lecturer',
            'إجازة': 'Bachelor Degree Holder',
            'ماجستير': 'Master Degree Holder',

            // Existing English options
            'Professor': 'Professor',
            'Associate Professor': 'Associate Professor',
            'Assistant Professor': 'Assistant Professor',
            'Lecturer': 'Lecturer',
            'Teaching Assistant': 'Teaching Assistant',
            'Research Assistant': 'Research Assistant',
        };

        // Mapping functions with smart translation fallback
        const mapTitle = async (title) => {
            if (!title) return '';
            
            // Normalize the title: trim, remove extra whitespace, and handle Arabic variations
            const normalizedTitle = title.trim()
                .replace(/\s+/g, ' ')  // Replace multiple whitespaces with single space
                .replace(/^ال\s*/, '');  // Remove leading "ال" and any following whitespace
            
            // Try mapping with original title first
            let mappedTitle = titleMappings[title.trim()] || 
                              titleMappings[normalizedTitle];
            
            // If no mapping found, use smart translation
            if (!mappedTitle) {
                mappedTitle = await smartTranslate(title, titleMappings, 'title');
            }
            
            return mappedTitle || normalizedTitle;
        };

        const mapScientificRank = async (rank) => {
            if (!rank) return '';
            
            // Normalize the rank: trim, remove extra whitespace, and handle Arabic variations
            const normalizedRank = rank.trim()
                .replace(/\s+/g, ' ')  // Replace multiple whitespaces with single space
                .replace(/^ال\s*/, '');  // Remove leading "ال" and any following whitespace
            
            // Try mapping with original rank first
            let mappedRank = scientificRankMappings[rank.trim()] || 
                             scientificRankMappings[normalizedRank];
            
            // If no mapping found, use smart translation
            if (!mappedRank) {
                mappedRank = await smartTranslate(rank, scientificRankMappings, 'rank');
            }
            
            return mappedRank || normalizedRank;
        };

        // Flexible header mapping function
        const findMatchingHeader = (row, targetKeys) => {
            const rowKeys = Object.keys(row);
            for (const targetKey of targetKeys) {
                const matchingKey = rowKeys.find(key => 
                    key.trim().replace(/\s+/g, '') === targetKey.trim().replace(/\s+/g, '')
                );
                if (matchingKey) return matchingKey;
            }
            return null;
        };

        // Comprehensive header mapping with multiple possible variations
        const headerMappings = {
            'name': ['الاسم', 'الاسم '],
            'title': ['اللقب'],
            'scientificRank': ['المرتبة العلمية'],
            'fatherName': ['اسم الأب'],
            'availability': ['التفرغ']
        };

        // Day mappings with multiple variations
        const dayMappings = {
            'saturday': ['السبت'],
            'sunday': ['الاحد', 'الأحد'],
            'monday': ['الاثنين', 'الإثنين'],
            'tuesday': ['الثلاثاء'],
            'wednesday': ['الاربعاء', 'الأربعاء'],
            'thursday': ['الخميس']
        };

        // Validate input before processing
        if (results.length === 0) {
            throw new Error("The uploaded Excel file is empty.");
        }

                // Process each row in the file
                for (const [index, row] of results.entries()) {
                    const rowNum = index + 2; // Excel rows start at 2
                    
                    try {
                        await client.query('BEGIN');
                        
                        console.log(`--- PROCESSING ROW ${rowNum} IN FILE ${fileIndex + 1} ---`);
                        console.log('Raw Row Data:', JSON.stringify(row, null, 2));

                // Detailed mapping with extensive logging
                const mappedRow = {};

                // Manually map each known column
                for (const [header, targetKeys] of Object.entries(headerMappings)) {
                    const matchingKey = findMatchingHeader(row, targetKeys);
                    if (matchingKey) {
                        mappedRow[header] = row[matchingKey];
                    }
                }

                console.log('Mapped Row:', JSON.stringify(mappedRow, null, 2));

                // Validate required fields
                if (!mappedRow.name) {
                    throw new Error('Missing required field: Name');
                }

                // Map titles and scientific ranks
                const mappedTitle = await mapTitle(mappedRow.title || '');
                const mappedScientificRank = await mapScientificRank(mappedRow.scientificRank || '');

                // Availability mapping with smart translation fallback
                const availabilityMapping = {
                    'جزئي': 'part-time',
                    'كامل': 'full-time',
                    'محاضر': 'part-time',  // Assuming 'محاضر' means part-time
                    'part-time': 'part-time',
                    'full-time': 'full-time'
                };
                
                let mappedAvailability = availabilityMapping[mappedRow.availability?.trim()];
                if (!mappedAvailability) {
                    mappedAvailability = await smartTranslate(mappedRow.availability, availabilityMapping, 'availability') || 'part-time';
                }

                console.log('Mapped Details:');
                console.log('Title:', mappedTitle);
                console.log('Scientific Rank:', mappedScientificRank);
                console.log('Availability:', mappedAvailability);

                // Generate default password
                const defaultPassword = crypto.randomBytes(8).toString('hex');
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                
                // Check for existing observer by name (and optionally father's name for better uniqueness)
                let existingObserver;
                if (mappedRow.fatherName) {
                    existingObserver = await client.query(
                        `SELECT o."observerid", o."name", o."fathername" 
                         FROM "observer" o 
                         WHERE LOWER(o."name") = LOWER($1) AND LOWER(o."fathername") = LOWER($2)`, 
                        [mappedRow.name.trim(), mappedRow.fatherName.trim()]
                    );
                } else {
                    existingObserver = await client.query(
                        `SELECT o."observerid", o."name" 
                         FROM "observer" o 
                         WHERE LOWER(o."name") = LOWER($1)`, 
                        [mappedRow.name.trim()]
                    );
                }

                if (existingObserver.rows.length > 0) {
                    const existing = existingObserver.rows[0];
                    console.log(`Skipping existing observer: "${mappedRow.name}" (ID: ${existing.observerid})`);
                    fileSummary.observersSkipped++;
                    await client.query('ROLLBACK');
                    continue; // Skip to next row
                }

                // Generate unique email
                const sanitizedName = mappedRow.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const uniquePart = crypto.randomBytes(3).toString('hex');
                const email = `${sanitizedName}.${uniquePart}@observers.local`;

                // Insert user info
                const userInfoResult = await client.query(
                    `INSERT INTO "userinfo" ("name", "email", "phonenum", "password") 
                     VALUES ($1, $2, $3, $4) RETURNING "id"`,
                    [mappedRow.name, email, null, hashedPassword]
                );
                
                const userInfoId = userInfoResult.rows[0].id;
                
                // Insert app user
                const appUserResult = await client.query(
                    `INSERT INTO "appuser" ("u_id", "roleid") 
                     VALUES ($1, $2) RETURNING "userid"`,
                    [userInfoId, observerRoleId]
                );
                
                const appUserId = appUserResult.rows[0].userid;
                
                // Insert observer
                const observerResult = await client.query(
                    `INSERT INTO "observer" ("u_id", "email", "password", "name", "phonenum", "title", "scientificrank", "fathername", "availability") 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING "observerid"`,
                    [
                        appUserId, 
                        email, 
                        hashedPassword, 
                        mappedRow.name, 
                        null, 
                        mappedTitle, 
                        mappedScientificRank, 
                        mappedRow.fatherName || '', 
                        mappedAvailability
                    ]
                );
                
                const newObserverId = observerResult.rows[0].observerid;
                
                // Process time slots
                for (const [englishDay, arabicDays] of Object.entries(dayMappings)) {
                    // Find the matching Arabic day key in the row
                    const matchingDayKey = arabicDays.find(arabicDay => 
                        row.hasOwnProperty(arabicDay)
                    );

                    if (matchingDayKey) {
                        const dayValue = row[matchingDayKey];
                        
                        console.log('Time Slot Debug:', {
                            englishDay,
                            arabicDays,
                            matchingDayKey,
                            dayValue,
                            rowKeys: Object.keys(row)
                        });

                        // Normalize dayValue
                        const normalizedDayValue = typeof dayValue === 'string' ? dayValue.trim() : dayValue;

                        if (normalizedDayValue === '√' || normalizedDayValue === '/' || normalizedDayValue === 'o') {
                            // Mark full day availability
                            // Capitalize first letter of day name
                            const capitalizedDay = englishDay.charAt(0).toUpperCase() + englishDay.slice(1);
                            await client.query(
                                `INSERT INTO timeslot (observerid, day, starttime, endtime) 
                                 VALUES ($1, $2, $3, $4)`,
                                [newObserverId, capitalizedDay, '08:00', '16:30']
                            );
                            fileSummary.timeSlotsCreated++;
                            console.log(`Inserted full day time slot for ${englishDay}`);
                        } else if (typeof normalizedDayValue === 'string' && 
                                   (normalizedDayValue.includes('-') || 
                                    normalizedDayValue.includes('من الساعة'))) {
                            try {
                                // Parse the time slot using the new utility
                                const parsedTimeSlot = parseTimeSlot(normalizedDayValue);
                                
                                // Validate and format start and end times
                                const startTime = validateAndFormatTime(parsedTimeSlot.startTime);
                                const endTime = validateAndFormatTime(parsedTimeSlot.endTime);

                                // Insert the time slot
                                // Capitalize first letter of day name
                                const capitalizedDay = englishDay.charAt(0).toUpperCase() + englishDay.slice(1);
                                await client.query(
                                    `INSERT INTO timeslot (observerid, day, starttime, endtime) 
                                     VALUES ($1, $2, $3, $4)`,
                                    [newObserverId, capitalizedDay, startTime, endTime]
                                );
                                fileSummary.timeSlotsCreated++;
                                console.log('Parsed and Inserted Time Slot:', {
                                    observerId: newObserverId,
                                    day: englishDay,
                                    startTime,
                                    endTime
                                });
                            } catch (parseError) {
                                console.error(`Error parsing time slot for ${englishDay}:`, parseError);
                                fileSummary.parseErrors.push({
                                    day: englishDay,
                                    value: normalizedDayValue,
                                    error: parseError.message
                                });
                            }
                        }
                    }
                }

                await client.query('COMMIT');
                fileSummary.observersCreated++;
                console.log(`Successfully created observer: ${mappedRow.name}`);
            } catch (rowError) {
                // Rollback the transaction
                await client.query('ROLLBACK');
                
                // Log the detailed error
                console.error(`Error processing row ${rowNum} in file ${fileIndex + 1}:`, rowError);
                
                // Add the error to the file summary
                fileSummary.errors.push({ 
                    row: rowNum, 
                    message: rowError.message 
                });

                // Continue processing other rows instead of stopping
                console.log(`Continuing with next row after error in row ${rowNum} of file ${fileIndex + 1}`);
            }
                }

                // Update file summary status
                const hasFileErrors = fileSummary.errors.length > 0 || fileSummary.parseErrors.length > 0;
                const hasFileSuccess = fileSummary.observersCreated > 0;
                
                if (hasFileErrors && !hasFileSuccess) {
                    fileSummary.status = 'failed';
                    overallSummary.filesFailed++;
                } else if (hasFileErrors && hasFileSuccess) {
                    fileSummary.status = 'partial';
                    overallSummary.filesSuccessful++;
                } else {
                    fileSummary.status = 'success';
                    overallSummary.filesSuccessful++;
                }

                // Update overall summary
                overallSummary.totalObserversCreated += fileSummary.observersCreated;
                overallSummary.totalTimeSlotsCreated += fileSummary.timeSlotsCreated;
                overallSummary.totalObserversSkipped += fileSummary.observersSkipped;
                overallSummary.errors.push(...fileSummary.errors);
                overallSummary.parseErrors.push(...fileSummary.parseErrors);

                console.log(`--- FILE ${fileIndex + 1} SUMMARY ---`);
                console.log('File:', fileSummary.fileName);
                console.log('Status:', fileSummary.status);
                console.log('Observers Created:', fileSummary.observersCreated);
                console.log('Observers Skipped:', fileSummary.observersSkipped);
                console.log('Time Slots Created:', fileSummary.timeSlotsCreated);
                console.log('Errors:', fileSummary.errors);
                console.log('Parse Errors:', fileSummary.parseErrors);

            } catch (fileError) {
                console.error(`Fatal error processing file ${fileIndex + 1} (${file.originalname}):`, fileError);
                
                fileSummary.status = 'failed';
                fileSummary.errors.push({ 
                    message: fileError.message 
                });
                
                overallSummary.filesFailed++;
                overallSummary.errors.push({
                    file: file.originalname,
                    message: fileError.message
                });
            }

            overallSummary.filesProcessed++;
            overallSummary.fileResults.push(fileSummary);
        }

        console.log('--- OVERALL UPLOAD SUMMARY ---');
        console.log('Total Files:', overallSummary.totalFiles);
        console.log('Files Processed:', overallSummary.filesProcessed);
        console.log('Files Successful:', overallSummary.filesSuccessful);
        console.log('Files Failed:', overallSummary.filesFailed);
        console.log('Total Observers Created:', overallSummary.totalObserversCreated);
        console.log('Total Observers Skipped:', overallSummary.totalObserversSkipped);
        console.log('Total Time Slots Created:', overallSummary.totalTimeSlotsCreated);
        console.log('File Results:', overallSummary.fileResults);

        // Determine response based on overall results
        const hasErrors = overallSummary.errors.length > 0 || overallSummary.parseErrors.length > 0;
        const hasSuccess = overallSummary.totalObserversCreated > 0;
        
        if (hasErrors && !hasSuccess) {
            // All files failed
            res.status(400).json({
                message: 'Upload completed with errors - no observers were created',
                summary: overallSummary
            });
        } else if (hasErrors && hasSuccess) {
            // Partial success
            res.status(207).json({
                message: 'Upload completed with partial success - some observers were created, some failed',
                summary: overallSummary
            });
        } else {
            // Complete success
            res.status(200).json({
                message: 'Observers uploaded successfully',
                summary: overallSummary
            });
        }
    } catch (err) {
        console.error('Fatal error during bulk observer upload:', err);
        
        // Return a detailed error response
        res.status(500).json({ 
            message: 'Failed to upload observers',
            error: err.message,
            details: overallSummary.errors.concat(overallSummary.parseErrors)
        });
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
  deleteObserver,
  bulkDeleteObservers,
  upload,
  uploadObservers,
};
