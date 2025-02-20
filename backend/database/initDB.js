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
      Availability availability_enum NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS TimeSlot (
      TimeSlotID SERIAL PRIMARY KEY,
      StartTime TIME NOT NULL,
      EndTime TIME NOT NULL,
      day VARCHAR(10),
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE
    );

    -- Create a function to check observer availability
    CREATE OR REPLACE FUNCTION check_observer_availability()
    RETURNS TRIGGER AS $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM Observer 
            WHERE ObserverID = NEW.ObserverID 
            AND Availability = 'full-time'
        ) THEN
            RAISE EXCEPTION 'Cannot add time slots for full-time observers';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger for inserting time slots
    DROP TRIGGER IF EXISTS check_timeslot_insert ON TimeSlot;
    CREATE TRIGGER check_timeslot_insert
    BEFORE INSERT ON TimeSlot
    FOR EACH ROW
    EXECUTE FUNCTION check_observer_availability();

    -- Create trigger for updating observer availability
    CREATE OR REPLACE FUNCTION check_observer_update()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.Availability = 'full-time' AND EXISTS (
            SELECT 1 FROM TimeSlot 
            WHERE ObserverID = NEW.ObserverID
        ) THEN
            RAISE EXCEPTION 'Cannot set observer to full-time when they have time slots';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger for updating observer
    DROP TRIGGER IF EXISTS check_observer_update ON Observer;
    CREATE TRIGGER check_observer_update
    BEFORE UPDATE ON Observer
    FOR EACH ROW
    EXECUTE FUNCTION check_observer_update();

    CREATE TABLE IF NOT EXISTS ExamSchedule (
      ExamID SERIAL PRIMARY KEY,
      CourseID INT REFERENCES Course(CourseID) ON DELETE CASCADE,
      RoomID INT REFERENCES Room(RoomID) ON DELETE CASCADE,
      ExamName VARCHAR(255) NOT NULL,      
      ExamType VARCHAR(50) NOT NULL,       
      StartTime TIME NOT NULL,
      EndTime TIME NOT NULL,
      ExamDate DATE NOT NULL,
      NumOfStudents INT NOT NULL,
      ExamHead INT REFERENCES Observer(ObserverID),
      ExamSecretary INT REFERENCES Observer(ObserverID),
      Status VARCHAR(50) DEFAULT 'unassigned',
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Timestamp update trigger
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.UpdatedAt = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_exam_timestamp ON ExamSchedule;
    CREATE TRIGGER update_exam_timestamp
    BEFORE UPDATE ON ExamSchedule
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

    CREATE TABLE IF NOT EXISTS Preferences (
      PreferenceID SERIAL PRIMARY KEY,
      ExamScheduleID INT REFERENCES ExamSchedule(ExamID) ON DELETE CASCADE,
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE,
      Description TEXT
    );

    -- First create the ENUM types
    CREATE TYPE semester_type AS ENUM ('First', 'Second', 'Summer');
    CREATE TYPE exam_type AS ENUM ('First', 'Second', 'Practical', 'Final');

    -- Then create the table
    CREATE TABLE IF NOT EXISTS UploadedSchedules (
      UploadID SERIAL PRIMARY KEY,
      AcademicYear VARCHAR(9) NOT NULL,
      Semester semester_type NOT NULL,
      ExamType exam_type NOT NULL,
      FileName VARCHAR(255) NOT NULL,
      UploadedBy INT REFERENCES AppUser(UserID),
      UploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ProcessedAt TIMESTAMP,
      Status VARCHAR(50) DEFAULT 'pending',
      ErrorLog TEXT,
      UNIQUE(AcademicYear, Semester, ExamType)
    );

    -- Modify ExamSchedule table to include the schedule reference
    ALTER TABLE ExamSchedule 
    ADD COLUMN ScheduleID INT REFERENCES UploadedSchedules(UploadID);
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
        -- First, insert admin users
        INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES
        ('amer', 'amer@gmail.com', '123456', '123456'),
        ('majd', 'majd@gmail.com', '123456', '123456');

        -- Then, insert regular users
        INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES
        ('Alice Smith', 'alice@example.com', '1234567890', 'password123'),
        ('Bob Johnson', 'bob@example.com', '0987654321', 'password456');

        -- Then, insert observer users separately
        INSERT INTO UserInfo (Name, Email, PhoneNum, Password) VALUES
        ('John Smith', 'john.smith@example.com', '1234567890', 'observerpassword'),
        ('Robert Johnson', 'robert.johnson@example.com', '0987654321', 'observerpassword'),
        ('David Brown', 'david.brown@example.com', '5555555555', 'observerpassword');
      `);
    }

    // Insert dummy data into AppUser if empty
    const appUserCount = await client.query('SELECT COUNT(*) FROM AppUser');
    if (parseInt(appUserCount.rows[0].count) === 0) {
      await client.query(`
        -- Insert admin users first
        INSERT INTO AppUser (U_ID, RoleID)
        SELECT 
          ui.ID,
          (SELECT RoleID FROM Roles WHERE RoleName = 'admin')
        FROM UserInfo ui
        WHERE ui.Email IN ('amer@gmail.com', 'majd@gmail.com');

        -- Insert regular users with their roles
        INSERT INTO AppUser (U_ID, RoleID)
        SELECT 
          ui.ID,
          CASE 
            WHEN ui.Email = 'alice@example.com' THEN (SELECT RoleID FROM Roles WHERE RoleName = 'normal_user')
            WHEN ui.Email = 'bob@example.com' THEN (SELECT RoleID FROM Roles WHERE RoleName = 'admin')
          END
        FROM UserInfo ui
        WHERE ui.Email IN ('alice@example.com', 'bob@example.com');

        -- Insert observers with observer role
        INSERT INTO AppUser (U_ID, RoleID)
        SELECT 
          ui.ID,
          (SELECT RoleID FROM Roles WHERE RoleName = 'observer')
        FROM UserInfo ui
        WHERE ui.Email IN (
          'john.smith@example.com',
          'robert.johnson@example.com',
          'david.brown@example.com'
        );
      `);
    }

    // Insert dummy data into Observer if empty
    const observerCount = await client.query('SELECT COUNT(*) FROM Observer');
    if (parseInt(observerCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO Observer (U_ID, Email, Password, Name, PhoneNum, Title, ScientificRank, FatherName, Availability) 
        SELECT 
          au.UserID,
          ui.Email,
          ui.Password,
          ui.Name,
          ui.PhoneNum,
          CASE 
            WHEN ui.Name = 'John Smith' THEN 'Dr.'
            WHEN ui.Name = 'Robert Johnson' THEN 'Prof.'
            ELSE 'Dr.'
          END as Title,
          CASE 
            WHEN ui.Name = 'John Smith' THEN 'Professor'
            WHEN ui.Name = 'Robert Johnson' THEN 'Associate Professor'
            ELSE 'Assistant Professor'
          END as ScientificRank,
          CASE 
            WHEN ui.Name = 'John Smith' THEN 'John Smith Sr.'
            WHEN ui.Name = 'Robert Johnson' THEN 'Robert Johnson Sr.'
            ELSE 'William Anderson'
          END as FatherName,
          CASE 
            WHEN ui.Name = 'John Smith' THEN 'full-time'::availability_enum
            ELSE 'part-time'::availability_enum
          END as Availability
        FROM AppUser au
        JOIN UserInfo ui ON au.U_ID = ui.ID
        WHERE ui.Email IN (
          'john.smith@example.com',
          'robert.johnson@example.com',
          'david.brown@example.com'
        );
      `);
    }

    // Insert dummy data into TimeSlot if empty (only for part-time observers)
    const timeSlotCount = await client.query('SELECT COUNT(*) FROM TimeSlot');
    if (parseInt(timeSlotCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO TimeSlot (StartTime, EndTime, day, ObserverID) VALUES
        ('09:00:00', '10:00:00', 'Monday', 2),    -- For Robert Johnson
        ('10:30:00', '11:30:00', 'Wednesday', 2),
        ('14:00:00', '15:00:00', 'Monday', 3),    -- For Alice Williams
        ('15:30:00', '16:30:00', 'Thursday', 3);
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

    // Insert dummy data into ExamSchedule if empty
    const examScheduleCount = await client.query('SELECT COUNT(*) FROM ExamSchedule');
    if (parseInt(examScheduleCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, ExamType, StartTime, EndTime, NumOfStudents, ExamDate, ExamHead, ExamSecretary) VALUES
        (1, 1, 'Midterm Exam', 'theoretical', '09:00:00', '11:00:00', 30, '2023-10-15', 1, 2),
        (2, 2, 'Final Exam', 'practical', '10:00:00', '13:00:00', 25, '2023-12-10', 2, 3);
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
