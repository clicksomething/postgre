const { Client } = require('pg');

// Create a new client instance
const client = new Client({
  user: '', // replace with your PostgreSQL username
  host: 'localhost',
  database: '', // replace with your database name
  password: '.', // replace with your PostgreSQL password
  port: 5432, // default PostgreSQL port
});

// Function to create tables

async function createTables() {

    try {
  
      await client.connect(); // Connect to the database
  
  
      // SQL queries to create tables in the correct order
  
      const queries = `
  
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
  
          SeatingCapacity INT NOT NULL
  
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
  
  
        CREATE TABLE IF NOT EXISTS AppUser  (  -- Renamed from User to AppUser 
  
          UserID SERIAL PRIMARY KEY,
  
          U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
  
          IsAdmin BOOLEAN NOT NULL DEFAULT FALSE
  
        );
  
  
        CREATE TABLE IF NOT EXISTS Observer (
  
          ObserverID SERIAL PRIMARY KEY,
  
          U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
  
          TimeSlotID INT REFERENCES TimeSlot(TimeSlotID) ON DELETE SET NULL,
  
          CourseID INT REFERENCES Course(CourseID) ON DELETE SET NULL
  
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
  
  
      // Execute the queries
  
      await client.query(queries);
  
      console.log('Tables created successfully!');
  
    } catch (err) {
  
      console.error('Error creating tables:', err);
  
    } finally {
  
      await client.end(); // Close the database connection
  
    }
  
  }
  
  
  // Run the function to create tables
  
  createTables();