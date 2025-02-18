const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function initDB() {
  const query = `
    -- Create the availability_enum type
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_enum') THEN
        CREATE TYPE availability_enum AS ENUM ('full-time', 'part-time');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS UserInfo (
      ID SERIAL PRIMARY KEY,
      Name VARCHAR(255) NOT NULL,
      Email VARCHAR(255) UNIQUE NOT NULL,
      PhoneNum VARCHAR(15),
      Password VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Course (
      CourseID SERIAL PRIMARY KEY,
      CourseName VARCHAR(255) NOT NULL,
      Departement VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS Room (
      RoomID SERIAL PRIMARY KEY,
      RoomNum VARCHAR(50) NOT NULL,
      SeatingCapacity INT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS Roles (
      RoleID SERIAL PRIMARY KEY,
      RoleName VARCHAR(255) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Permissions (
      PermissionID SERIAL PRIMARY KEY,
      PermissionName VARCHAR(255) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS RolePermissions (
      RoleID INT REFERENCES Roles(RoleID) ON DELETE CASCADE,
      PermissionID INT REFERENCES Permissions(PermissionID) ON DELETE CASCADE,
      PRIMARY KEY (RoleID, PermissionID)
    );

    CREATE TABLE IF NOT EXISTS AppUser (
      UserID SERIAL PRIMARY KEY,
      U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
      RoleID INT REFERENCES Roles(RoleID) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Observer (
      ObserverID SERIAL PRIMARY KEY,
      U_ID INT REFERENCES AppUser(UserID) ON DELETE CASCADE,
      Email VARCHAR(255) NOT NULL,
      Password VARCHAR(255) NOT NULL,
      Name VARCHAR(255) NOT NULL,
      PhoneNum VARCHAR(15),
      Title VARCHAR(255),
      ScientificRank VARCHAR(255),
      FatherName VARCHAR(255),
      Availability availability_enum NOT NULL,
    );
    
    CREATE TABLE IF NOT EXISTS TimeSlot (
      TimeSlotID SERIAL PRIMARY KEY,
      StartTime TIME  NOT NULL,
      EndTime TIME  NOT NULL,
      day VARCHAR(10),
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ExamSchedule (
      ExamID SERIAL PRIMARY KEY,
      CourseID INT REFERENCES Course(CourseID) ON DELETE CASCADE,
      RoomID INT REFERENCES Room(RoomID) ON DELETE CASCADE,
      ExamName VARCHAR(255) NOT NULL,
      StartTime TIME  NOT NULL,
      EndTime TIME  NOT NULL,
      NumOfStudents INT,
      ExamDate DATE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Preferences (
      PreferenceID SERIAL PRIMARY KEY,
      ExamScheduleID INT REFERENCES ExamSchedule(ExamID) ON DELETE CASCADE,
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE,
      Description TEXT
    );

    CREATE TABLE IF NOT EXISTS DistributeSchedule (
      ScheduleID SERIAL PRIMARY KEY,
      ExamScheduleID INT REFERENCES ExamSchedule(ExamID) ON DELETE CASCADE,
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE
    );
  `;

  try {
    await client.connect();
    await client.query('BEGIN');  // Start the transaction

    console.log("Starting to create tables...");
    // Execute the queries
    await client.query(query);
    console.log("Tables created successfully!");

    // Insert default roles and permissions
    await client.query(`
      INSERT INTO Roles (RoleName) VALUES
      ('normal_user'),
      ('admin'),
      ('observer')
      ON CONFLICT (RoleName) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO Permissions (PermissionName) VALUES
      ('upload_schedule'),
      ('manage_users'),
      ('view_schedule')
      ON CONFLICT (PermissionName) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO RolePermissions (RoleID, PermissionID) VALUES
      ((SELECT RoleID FROM Roles WHERE RoleName = 'normal_user'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'upload_schedule')),
      ((SELECT RoleID FROM Roles WHERE RoleName = 'normal_user'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'view_schedule')),
      ((SELECT RoleID FROM Roles WHERE RoleName = 'admin'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'manage_users')),
      ((SELECT RoleID FROM Roles WHERE RoleName = 'admin'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'upload_schedule')),
      ((SELECT RoleID FROM Roles WHERE RoleName = 'admin'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'view_schedule')),
      ((SELECT RoleID FROM Roles WHERE RoleName = 'observer'), (SELECT PermissionID FROM Permissions WHERE PermissionName = 'view_schedule'))
      ON CONFLICT DO NOTHING;
    `);

    // Insert dummy data into UserInfo if empty
    const userCount = await client.query('SELECT COUNT(*) FROM UserInfo');
    if (parseInt(userCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES
        ('Alice Smith', 'alice@example.com', '1234567890', 'password123'),
        ('Bob Johnson', 'bob@example.com', '0987654321', 'password456'),
        ('Charlie Brown', 'charlie@example.com', '5555555555', 'password789');
      `);
    }

    // Insert dummy data into AppUser if empty
    const appUserCount = await client.query('SELECT COUNT(*) FROM AppUser');
    if (parseInt(appUserCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO AppUser (U_ID, RoleID) VALUES
        (1, (SELECT RoleID FROM Roles WHERE RoleName = 'normal_user')),
        (2, (SELECT RoleID FROM Roles WHERE RoleName = 'admin')),
        (3, (SELECT RoleID FROM Roles WHERE RoleName = 'observer')),
        (1, (SELECT RoleID FROM Roles WHERE RoleName = 'observer')),
        (2, (SELECT RoleID FROM Roles WHERE RoleName = 'observer'));
      `);
    }

    // Insert dummy data into Observer if empty
    const observerCount = await client.query('SELECT COUNT(*) FROM Observer');
    if (parseInt(observerCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Observer (U_ID, CourseID, Title, ScientificRank, FatherName, Availability, Email, Password, Name, PhoneNum) VALUES
        (1, NULL, 'Dr.', 'Professor', 'John Smith', 'full-time', 'john.smith@example.com', 'observerpassword', 'John Smith', '1234567890'),
        (2, NULL, 'Prof.', 'Associate Professor', 'Robert Johnson', 'part-time', 'robert.johnson@example.com', 'observerpassword', 'Robert Johnson', '0987654321');
      `);
    }

    // Insert dummy data into Course if empty
    const courseCount = await client.query('SELECT COUNT(*) FROM Course');
    if (parseInt(courseCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Course (CourseName, Departement) VALUES
        ('Introduction to Programming', 'Computer Science'),
        ('Data Structures and Algorithms', 'Computer Science'),
        ('Database Management Systems', 'Information Technology'),
        ('Web Development', 'Computer Science'),
        ('Machine Learning', 'Artificial Intelligence');
      `);
    }

    // Insert dummy data into Room if empty
    const roomCount = await client.query('SELECT COUNT(*) FROM Room');
    if (parseInt(roomCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Room (RoomNum, SeatingCapacity) VALUES
        ('Room 101', 30),
        ('Room 102', 25),
        ('Room 201', 50),
        ('Room 202', 40),
        ('Room 301', 20);
      `);
    }

    // Insert dummy data into TimeSlot if empty
    const timeSlotCount = await client.query('SELECT COUNT(*) FROM TimeSlot');
    if (parseInt(timeSlotCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO TimeSlot (StartTime, EndTime, day, ObserverID) VALUES
        (' 09:00:00', ' 10:00:00', 'Monday', 1),
        (' 10:30:00', ' 11:30:00', 'Monday', 1),
        (' 12:00:00', ' 13:00:00', 'Monday', 1);
      `);
    }

    // Insert dummy data into ExamSchedule if empty
    const examScheduleCount = await client.query('SELECT COUNT(*) FROM ExamSchedule');
    if (parseInt(examScheduleCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, StartTime, EndTime, NumOfStudents, ExamDate) VALUES
        (1, 1, 'Midterm Exam',  '09:00:00', ' 11:00:00', 30, '2023-10-15'),
        (2, 2, 'Final Exam', '10:00:00', ' 13:00:00', 25, '2023-12-10');
      `);
    }

    // Insert dummy data into Preferences if empty
    const preferencesCount = await client.query('SELECT COUNT(*) FROM Preferences');
    if (parseInt(preferencesCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Preferences (ExamScheduleID, ObserverID, Description) VALUES
        (1, 1, 'Preferred time slot for the exam.'),
        (2, 2, 'Needs additional resources for preparation.');
      `);
    }

    // Insert dummy data into DistributeSchedule if empty
    const distributeScheduleCount = await client.query('SELECT COUNT(*) FROM DistributeSchedule');
    if (parseInt(distributeScheduleCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO DistributeSchedule (ExamScheduleID, ObserverID) VALUES
        (1, 1),
        (2, 2);
      `);
    }

    // If we reach here, commit the transaction
    await client.query('COMMIT');
    console.log("Database setup completed successfully!");
  } catch (err) {
    // If an error occurs, roll back the transaction
    await client.query('ROLLBACK');
    console.error("Error creating tables, transaction rolled back:", err);
  } finally {
    await client.end();
  }
}

module.exports = initDB;
