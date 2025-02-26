const { Client } = require('pg');
require('dotenv').config();

async function initDB() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  const query = `
    -- Create the availability_enum type if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_enum') THEN
        CREATE TYPE availability_enum AS ENUM ('full-time', 'part-time');
      END IF;
    END $$;

    -- Create semester_type enum if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'semester_type') THEN
        CREATE TYPE semester_type AS ENUM ('First', 'Second', 'Summer');
      END IF;
    END $$;

    -- Create exam_type enum if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_type') THEN
        CREATE TYPE exam_type AS ENUM ('First', 'Second', 'Practical', 'Final');
      END IF;
    END $$;

    -- Create UserInfo table first
    CREATE TABLE IF NOT EXISTS UserInfo (
      ID SERIAL PRIMARY KEY,
      Name VARCHAR(255) NOT NULL,
      Email VARCHAR(255) UNIQUE NOT NULL,
      PhoneNum VARCHAR(15),
      Password VARCHAR(255) NOT NULL
    );

    -- Create Roles table
    CREATE TABLE IF NOT EXISTS Roles (
      RoleID SERIAL PRIMARY KEY,
      RoleName VARCHAR(255) UNIQUE NOT NULL
    );

    -- Create Permissions table
    CREATE TABLE IF NOT EXISTS Permissions (
      PermissionID SERIAL PRIMARY KEY,
      PermissionName VARCHAR(255) UNIQUE NOT NULL
    );

    -- Create RolePermissions table
    CREATE TABLE IF NOT EXISTS RolePermissions (
      RoleID INT REFERENCES Roles(RoleID) ON DELETE CASCADE,
      PermissionID INT REFERENCES Permissions(PermissionID) ON DELETE CASCADE,
      PRIMARY KEY (RoleID, PermissionID)
    );

    -- Create AppUser table
    CREATE TABLE IF NOT EXISTS AppUser (
      UserID SERIAL PRIMARY KEY,
      U_ID INT REFERENCES UserInfo(ID) ON DELETE CASCADE,
      RoleID INT REFERENCES Roles(RoleID) ON DELETE SET NULL
    );

    -- Create UploadedSchedules table
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

    -- Create Observer table
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

    -- Create TimeSlot table
    CREATE TABLE IF NOT EXISTS TimeSlot (
      TimeSlotID SERIAL PRIMARY KEY,
      StartTime TIME NOT NULL,
      EndTime TIME NOT NULL,
      day VARCHAR(10),
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE
    );

    -- Create Course table
    CREATE TABLE IF NOT EXISTS Course (
      CourseID SERIAL PRIMARY KEY,
      CourseName VARCHAR(255) NOT NULL,
      Departement VARCHAR(255)
    );

    -- Create Room table
    CREATE TABLE IF NOT EXISTS Room (
      RoomID SERIAL PRIMARY KEY,
      RoomNum VARCHAR(50) NOT NULL,
      SeatingCapacity INT NOT NULL
    );

    -- Create ExamSchedule table
    CREATE TABLE IF NOT EXISTS ExamSchedule (
      ExamID SERIAL PRIMARY KEY,
      CourseID INT REFERENCES Course(CourseID) ON DELETE CASCADE,
      RoomID INT REFERENCES Room(RoomID) ON DELETE CASCADE,
      ScheduleID INT REFERENCES UploadedSchedules(UploadID) ON DELETE CASCADE,
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

    -- Create ExamAssignment table
    CREATE TABLE IF NOT EXISTS ExamAssignment (
        AssignmentID SERIAL PRIMARY KEY,
        ExamID INT REFERENCES ExamSchedule(ExamID) ON DELETE CASCADE,
        ScheduleID INT REFERENCES UploadedSchedules(UploadID) ON DELETE CASCADE,
        ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE,
        Role VARCHAR(50) CHECK (Role IN ('head', 'secretary')),
        AssignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Status VARCHAR(50) DEFAULT 'active',
        UNIQUE(ExamID, Role, ScheduleID),
        UNIQUE(ExamID, ObserverID, ScheduleID)
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

    -- Create function to sync assignments with ExamSchedule
    CREATE OR REPLACE FUNCTION sync_exam_assignments()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            -- Update ExamSchedule based on role
            IF NEW.Role = 'head' THEN
                UPDATE ExamSchedule 
                SET ExamHead = NEW.ObserverID,
                    Status = CASE 
                        WHEN ExamSecretary IS NOT NULL THEN 'assigned'
                        ELSE 'partially_assigned'
                    END
                WHERE ExamID = NEW.ExamID;
            ELSIF NEW.Role = 'secretary' THEN
                UPDATE ExamSchedule 
                SET ExamSecretary = NEW.ObserverID,
                    Status = CASE 
                        WHEN ExamHead IS NOT NULL THEN 'assigned'
                        ELSE 'partially_assigned'
                    END
                WHERE ExamID = NEW.ExamID;
            END IF;
        ELSIF TG_OP = 'DELETE' THEN
            -- Handle removal of assignments
            IF OLD.Role = 'head' THEN
                UPDATE ExamSchedule 
                SET ExamHead = NULL,
                    Status = CASE 
                        WHEN ExamSecretary IS NOT NULL THEN 'partially_assigned'
                        ELSE 'unassigned'
                    END
                WHERE ExamID = OLD.ExamID;
            ELSIF OLD.Role = 'secretary' THEN
                UPDATE ExamSchedule 
                SET ExamSecretary = NULL,
                    Status = CASE 
                        WHEN ExamHead IS NOT NULL THEN 'partially_assigned'
                        ELSE 'unassigned'
                    END
                WHERE ExamID = OLD.ExamID;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create triggers for ExamAssignment
    DROP TRIGGER IF EXISTS exam_assignment_sync_trigger ON ExamAssignment;
    CREATE TRIGGER exam_assignment_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON ExamAssignment
    FOR EACH ROW
    EXECUTE FUNCTION sync_exam_assignments();

    CREATE TABLE IF NOT EXISTS Preferences (
      PreferenceID SERIAL PRIMARY KEY,
      ExamScheduleID INT REFERENCES ExamSchedule(ExamID) ON DELETE CASCADE,
      ObserverID INT REFERENCES Observer(ObserverID) ON DELETE CASCADE,
      Description TEXT
    );


  `;

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(query);

    // Insert Roles
    const rolesQuery = `
      INSERT INTO Roles (RoleName)
      VALUES 
        ('normal_user'),
        ('admin'),
        ('observer')
      ON CONFLICT (RoleName) DO NOTHING;
    `;
    await client.query(rolesQuery);

    // Insert Permissions
    const permissionsQuery = `
      INSERT INTO Permissions (PermissionName)
      VALUES 
        ('create_exam'),
        ('edit_exam'),
        ('delete_exam'),
        ('assign_observer'),
        ('view_reports')
      ON CONFLICT (PermissionName) DO NOTHING;
    `;
    await client.query(permissionsQuery);

    // Insert RolePermissions
    const rolePermissionsQuery = `
      INSERT INTO RolePermissions (RoleID, PermissionID)
      SELECT r.RoleID, p.PermissionID
      FROM Roles r, Permissions p
      WHERE r.RoleName = 'admin' AND p.PermissionName IN (
        'create_exam', 'edit_exam', 'delete_exam', 'assign_observer', 'view_reports'
      )
      UNION ALL
      SELECT r.RoleID, p.PermissionID
      FROM Roles r, Permissions p
      WHERE r.RoleName = 'observer' AND p.PermissionName IN (
        'create_exam', 'edit_exam', 'delete_exam', 'assign_observer', 'view_reports'
      )
      ON CONFLICT (RoleID, PermissionID) DO NOTHING;
    `;
    await client.query(rolePermissionsQuery);

    await client.query('COMMIT');
    console.log("Database setup and roles/permissions inserted successfully!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during initialization:", err);
  } finally {
    await client.end();
  }
}

module.exports = initDB;
