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
    -- Check if the enum type already exists
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

    CREATE TABLE IF NOT EXISTS TimeSlot (
      TimeSlotID SERIAL PRIMARY KEY,
      StartTime TIMESTAMP NOT NULL,
      EndTime TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS AppUser (
      UserID SERIAL PRIMARY KEY,
      U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
      IsAdmin BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS Observer (
      ObserverID SERIAL PRIMARY KEY,
      U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
      TimeSlotID INT REFERENCES TimeSlot(TimeSlotID) ON DELETE SET NULL,
      CourseID INT REFERENCES Course(CourseID) ON DELETE SET NULL,
      Name VARCHAR(255) NOT NULL,  -- Observer's Name
      ScientificRank VARCHAR(255), -- Observer's Scientific Rank
      FatherName VARCHAR(255),     -- Observer's Father's Name
      Availability availability_enum NOT NULL  -- Observer's availability (Full-time or Part-time)
    );

    CREATE TABLE IF NOT EXISTS ExamSchedule (
      ExamID SERIAL PRIMARY KEY,
      CourseID INT REFERENCES Course(CourseID) ON DELETE CASCADE,
      RoomID INT REFERENCES Room(RoomID) ON DELETE CASCADE,
      ExamName VARCHAR(255) NOT NULL,
      ExamType VARCHAR(50),
      ExamDate DATE NOT NULL,
      Duration INTERVAL NOT NULL
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
    console.log("Enum type and tables created successfully!");

    // Insert dummy data only if tables are empty
    const userCount = await client.query('SELECT COUNT(*) FROM UserInfo');
    if (parseInt(userCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES
        ('Alice Smith', 'alice@example.com', '1234567890', 'password123'),
        ('Bob Johnson', 'bob@example.com', '0987654321', 'password456'),
        ('Charlie Brown', 'charlie@example.com', '5555555555', 'password789');
      `);
    }

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

    const timeSlotCount = await client.query('SELECT COUNT(*) FROM TimeSlot');
    if (parseInt(timeSlotCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO TimeSlot (StartTime, EndTime) VALUES
        ('2023-10-01 09:00:00', '2023-10-01 10:00:00'),
        ('2023-10-01 10:30:00', '2023-10-01 11:30:00'),
        ('2023-10-01 12:00:00', '2023-10-01 13:00:00');
      `);
    }

    const appUserCount = await client.query('SELECT COUNT(*) FROM AppUser');
    if (parseInt(appUserCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO AppUser (U_ID, IsAdmin) VALUES
        (1, TRUE),
        (2, FALSE),
        (3, FALSE);
      `);
    }

    const observerCount = await client.query('SELECT COUNT(*) FROM Observer');
    if (parseInt(observerCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Observer (U_ID, TimeSlotID, CourseID, Name, ScientificRank, FatherName, Availability) VALUES
        (1, 1, 1, 'Dr. Emily White', 'Professor', 'John White', 'full-time'),
        (2, 2, 2, 'Dr. Michael Green', 'Associate Professor', 'Robert Green', 'part-time');
      `);
    }

    const examScheduleCount = await client.query('SELECT COUNT(*) FROM ExamSchedule');
    if (parseInt(examScheduleCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, ExamType, ExamDate, Duration) VALUES
        (1, 1, 'Midterm Exam', 'Written', '2023-10-15', '2 hours'),
        (2, 2, 'Final Exam', 'Written', '2023-12-10', '3 hours');
      `);
    }

    const preferencesCount = await client.query('SELECT COUNT(*) FROM Preferences');
    if (parseInt(preferencesCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Preferences (ExamScheduleID, ObserverID, Description) VALUES
        (1, 1, 'Preferred time slot for the exam.'),
        (2, 2, 'Needs additional resources for preparation.');
      `);
    }

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

// Export the function to be used in index.js
module.exports = initDB;
