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
