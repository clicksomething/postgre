const { client } = require('../../database/db'); // Database connection

const multer = require('multer'); // For file uploads
const xlsx = require('xlsx'); // For parsing Excel files
const storage = multer.memoryStorage(); // Store file in memory

// File filter for multer
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
    } else {
        cb(new Error('Only Excel files are allowed!'), false);
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Arabic to English field mapping - exact match with Excel headers
const fieldMapping = {
    'اسم القاعة': 'roomNum',
    'تاريخ الامتحان': 'examDate',
    'اليوم': 'day',
    'وقت البداية': 'startTime',
    'وقت النهاية': 'endTime',
    'اسم الامتحان': 'examName',
    'عدد الطلاب في القاعة': 'numOfStudents',
    'المقررات': 'courseName',
    'رئيس القاعة': 'examHead',
    'أمين السر': 'examSecretary'
};

// Helper function to clean numeric values
const cleanNumericValue = (value) => {
    if (!value && value !== 0) {
        throw new Error('Numeric value is required');
    }
    
    // If it's already a number, return it
    if (typeof value === 'number') return value;
    
    // Remove any spaces and try to parse
    const cleaned = value.toString().trim();
    const parsed = parseInt(cleaned);
    
    if (isNaN(parsed)) {
        throw new Error(`Invalid numeric value: ${value}`);
    }
    
    return parsed;
};

// Enhanced date formatting with validation
const formatExcelDate = (dateStr) => {
    try {
        if (!dateStr) throw new Error('Date value is required');

        // Clean the input string
        const cleanDate = dateStr.trim();
        
        // Check if it's in DD/MM/YYYY format
        const dateParts = cleanDate.split('/');
        if (dateParts.length !== 3) {
            throw new Error(`Invalid date format: ${dateStr}. Expected format: DD/MM/YYYY`);
        }

        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
        const year = parseInt(dateParts[2]);

        // Create and validate the date
        const date = new Date(year, month, day);
        
        // Validate the date is real
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date: ${dateStr}`);
        }

        // Return in YYYY-MM-DD format for PostgreSQL
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } catch (error) {
        console.error('Date conversion error:', error);
        throw new Error(`Invalid date format: ${dateStr}`);
    }
};

// Update time format handling for AM/PM format
const formatExcelTime = (timeStr) => {
    try {
        if (!timeStr) throw new Error('Time value is required');
        
        // Handle AM/PM format
        const timePattern = /^(0?[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/i;
        const trimmedTime = timeStr.toString().trim();
        
        if (!timePattern.test(trimmedTime)) {
            throw new Error(`Invalid time format: ${timeStr}. Expected format: HH:MM AM/PM`);
        }
        
        // Convert to 24-hour format for database
        const [time, period] = trimmedTime.split(' ');
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        
        if (period.toUpperCase() === 'PM' && hour !== 12) {
            hour += 12;
        } else if (period.toUpperCase() === 'AM' && hour === 12) {
            hour = 0;
        }
        
        return `${hour.toString().padStart(2, '0')}:${minutes}`;
    } catch (error) {
        console.error('Time conversion error:', error);
        throw new Error(`Invalid time format: ${timeStr}`);
    }
};

// Validate required fields
const validateRow = (row) => {
    const requiredFields = [
        'اسم القاعة',
        'تاريخ الامتحان',
        'اليوم',
        'وقت البداية',
        'وقت النهاية',
        'اسم الامتحان',
        'عدد الطلاب في القاعة',
        'المقررات'
    ];

    const missingFields = requiredFields.filter(field => !row[field]);
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
};

// Helper function to get or create course
const getOrCreateCourse = async (client, courseName) => {
    try {
        if (!courseName) {
            throw new Error('Course name is required');
        }

        const cleanCourseName = courseName.toString().trim();
        
        // Use explicit type casting for the parameter
        const query = `
            WITH new_course AS (
                INSERT INTO Course (CourseName)
                SELECT $1::VARCHAR
                WHERE NOT EXISTS (
                    SELECT 1 FROM Course WHERE CourseName = $1::VARCHAR
                )
                RETURNING CourseID
            )
            SELECT CourseID 
            FROM new_course 
            UNION 
            SELECT CourseID 
            FROM Course 
            WHERE CourseName = $1::VARCHAR;
        `;
        
        const result = await client.query(query, [cleanCourseName]);
        const courseId = result.rows[0].courseid;
        console.log(`Course ID for ${cleanCourseName}: ${courseId}`);
        return courseId;
    } catch (error) {
        console.error('Error in getOrCreateCourse:', error);
        throw new Error(`Failed to process course: ${courseName}. Error: ${error.message}`);
    }
};

// Helper function to get or create room
const getOrCreateRoom = async (client, roomNum, seatingCapacity) => {
    try {
        if (!roomNum) {
            throw new Error('Room number is required');
        }

        const cleanRoomNum = roomNum.toString().trim();
        const cleanCapacity = cleanNumericValue(seatingCapacity);
        
        // Use explicit type casting for the parameters
        const query = `
            WITH new_room AS (
                INSERT INTO Room (RoomNum, SeatingCapacity)
                SELECT $1::VARCHAR, $2::INTEGER
                WHERE NOT EXISTS (
                    SELECT 1 FROM Room WHERE RoomNum = $1::VARCHAR
                )
                RETURNING RoomID
            )
            SELECT RoomID 
            FROM new_room 
            UNION 
            SELECT RoomID 
            FROM Room 
            WHERE RoomNum = $1::VARCHAR;
        `;
        
        const result = await client.query(query, [cleanRoomNum, cleanCapacity]);
        const roomId = result.rows[0].roomid;
        console.log(`Room ID for ${cleanRoomNum}: ${roomId}`);
        return roomId;
    } catch (error) {
        console.error('Error in getOrCreateRoom:', error);
        throw new Error(`Failed to process room: ${roomNum}. Error: ${error.message}`);
    }
};

const createExam = async (req, res) => {
    const { courseId, roomId, examName, examDate, startTime, endTime, numOfStudents } = req.body;

    try {
        const result = await client.query(
            `INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, StartTime, EndTime, NumOfStudents, ExamDate) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [courseId, roomId, examName, startTime, endTime, numOfStudents, examDate]
        );

        res.status(201).json({ message: "Exam created successfully", exam: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating exam" });
    }
};

const getAllExams = async (req, res) => {
    try {
        const result = await client.query(`
            SELECT 
                e.*,
                TO_CHAR(e.ExamDate, 'Day') as DayOfWeek,
                c.CourseName,
                r.RoomNum
            FROM ExamSchedule e
            JOIN Course c ON e.CourseID = c.CourseID
            JOIN Room r ON e.RoomID = r.RoomID
            ORDER BY e.ExamDate, e.StartTime
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching exams" });
    }
};

const getExamById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await client.query(`SELECT * FROM ExamSchedule WHERE ExamID = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching exam" });
    }
};

const updateExam = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId); // Changed from id to examId to match route
        console.log('Attempting to update exam with ID:', examId);
        console.log('Update data:', req.body);

        // Check if exam exists first
        const examCheck = await client.query(
            'SELECT * FROM ExamSchedule WHERE ExamID = $1',
            [examId]
        );

        console.log('Exam check result:', examCheck.rows);

        if (examCheck.rows.length === 0) {
            console.log('No exam found with ID:', examId);
            return res.status(404).json({
                message: "Exam not found"
            });
        }

        const { courseId, roomId, examName, examDate, startTime, endTime, numOfStudents } = req.body;

        // Start building the query
        let query = `UPDATE ExamSchedule SET `;
        const values = [];
        let index = 1;
        let fieldsProvided = false;

        // Check which fields are provided and build the query
        if (courseId) {
            query += `CourseID = $${index++}, `;
            values.push(courseId);
            fieldsProvided = true;
        }
        if (roomId) {
            query += `RoomID = $${index++}, `;
            values.push(roomId);
            fieldsProvided = true;
        }
        if (examName) {
            query += `ExamName = $${index++}, `;
            values.push(examName);
            fieldsProvided = true;
        }
        if (startTime) {
            query += `StartTime = $${index++}, `;
            values.push(startTime);
            fieldsProvided = true;
        }
        if (endTime) {
            query += `EndTime = $${index++}, `;
            values.push(endTime);
            fieldsProvided = true;
        }
        if (numOfStudents) {
            query += `NumOfStudents = $${index++}, `;
            values.push(numOfStudents);
            fieldsProvided = true;
        }
        if (examDate) {
            query += `ExamDate = $${index++}, `;
            values.push(examDate);
            fieldsProvided = true;
        }

        // If no fields were provided, return an error
        if (!fieldsProvided) {
            return res.status(400).json({ message: "No fields provided for update" });
        }

        // Remove the last comma and space
        query = query.slice(0, -2);
        query += ` WHERE ExamID = $${index} RETURNING *`;
        values.push(examId);

        console.log('Final query:', query);
        console.log('Query values:', values);

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }

        res.json({ message: "Exam updated successfully", exam: result.rows[0] });
    } catch (error) {
        console.error('Error updating exam:', error);
        res.status(500).json({ 
            message: "Error updating exam", 
            error: error.message 
        });
    }
};

// Delete a specific exam
const deleteExam = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId); // Convert to number
        
        if (!examId || isNaN(examId)) {
            console.log('Invalid exam ID:', req.params.examId);
            return res.status(400).json({
                message: "Invalid exam ID provided"
            });
        }

        console.log('Attempting to delete exam with ID:', examId);

        const examCheck = await client.query(
            `SELECT e.*, c.CourseName 
             FROM ExamSchedule e
             LEFT JOIN Course c ON e.CourseID = c.CourseID
             WHERE e.ExamID = $1`,
            [examId]
        );

        console.log('Query result:', examCheck.rows);

        if (examCheck.rows.length === 0) {
            console.log('No exam found with ID:', examId);
            return res.status(404).json({
                message: "Exam not found"
            });
        }

        console.log('Found exam:', examCheck.rows[0]);

        const deleteResult = await client.query(
            'DELETE FROM ExamSchedule WHERE ExamID = $1 RETURNING *',
            [examId]
        );

        console.log('Delete result:', deleteResult.rows);

        res.json({
            message: "Exam deleted successfully",
            deletedExam: {
                examId: examId,
                courseName: examCheck.rows[0].coursename,
                examName: examCheck.rows[0].examname,
                examDate: examCheck.rows[0].examdate
            }
        });
    } catch (error) {
        console.error('Error deleting exam:', error);
        res.status(500).json({ 
            message: "Error deleting exam", 
            error: error.message 
        });
    }
};

// Delete an entire schedule and its exams
const deleteSchedule = async (req, res) => {
    const { scheduleId } = req.params;

    try {
        await client.query('BEGIN');

        // Check if schedule exists
        const scheduleCheck = await client.query(
            'SELECT * FROM UploadedSchedules WHERE UploadID = $1',
            [scheduleId]
        );

        if (scheduleCheck.rows.length === 0) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        // Delete all exams in this schedule
        await client.query(
            'DELETE FROM ExamSchedule WHERE ScheduleID = $1',
            [scheduleId]
        );

        // Delete the schedule
        await client.query(
            'DELETE FROM UploadedSchedules WHERE UploadID = $1',
            [scheduleId]
        );

        await client.query('COMMIT');

        res.json({
            message: "Schedule and all associated exams deleted successfully",
            deletedScheduleId: scheduleId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting schedule:', error);
        res.status(500).json({ 
            message: "Error deleting schedule", 
            error: error.message 
        });
    }
};

const uploadExamSchedule = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const { academicYear, semester, examType } = req.body;
        
        if (!academicYear || !semester || !examType) {
            return res.status(400).json({ 
                message: "Academic year, semester, and exam type are required" 
            });
        }

        if (!['First', 'Second', 'Summer'].includes(semester)) {
            return res.status(400).json({ 
                message: "Invalid semester. Must be First, Second, or Summer" 
            });
        }

        if (!['First', 'Second', 'Final'].includes(examType)) {
            return res.status(400).json({ 
                message: "Invalid exam type. Must be First, Second, or Final" 
            });
        }

        const yearPattern = /^(\d{4})-(\d{4})$/;
        if (!yearPattern.test(academicYear)) {
            return res.status(400).json({ 
                message: "Invalid academic year format. Must be YYYY-YYYY" 
            });
        }

        const workbook = xlsx.read(req.file.buffer, { 
            type: "buffer",
            codepage: 65001
        });

        if (workbook.SheetNames.length === 0) {
            return res.status(400).json({ message: "Excel file is empty" });
        }

        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (sheetData.length === 0) {
            return res.status(400).json({ message: "No data found in the Excel file" });
        }

        await client.query('BEGIN');

        try {
            const uploadResult = await client.query(
                `INSERT INTO UploadedSchedules 
                 (AcademicYear, Semester, ExamType, FileName, UploadedBy, Status) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING UploadID`,
                [
                    academicYear,
                    semester,
                    examType,
                    req.file.originalname,
                    1, // TODO: Replace with actual user ID
                    'processing'
                ]
            );

            const scheduleId = uploadResult.rows[0].uploadid;

            for (const [index, row] of sheetData.entries()) {
                try {
                    const courseId = await getOrCreateCourse(client, row['المقررات']);
                    const roomId = await getOrCreateRoom(client, row['اسم القاعة'], row['عدد الطلاب في القاعة']);

                    const examDate = formatExcelDate(row['تاريخ الامتحان']);
                    const startTime = formatExcelTime(row['وقت البداية']);
                    const endTime = formatExcelTime(row['وقت النهاية']);

                    await client.query(
                        `INSERT INTO ExamSchedule (
                            ScheduleID, CourseID, RoomID, ExamName, ExamType,
                            StartTime, EndTime, NumOfStudents, 
                            ExamDate, Status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            scheduleId,
                            courseId,
                            roomId,
                            row['اسم الامتحان'],
                            examType,
                            startTime,
                            endTime,
                            cleanNumericValue(row['عدد الطلاب في القاعة']),
                            examDate,
                            'unassigned'
                        ]
                    );
                } catch (error) {
                    throw new Error(`Error in row ${index + 1}: ${error.message}`);
                }
            }

            await client.query(
                `UPDATE UploadedSchedules 
                 SET Status = $1, ProcessedAt = CURRENT_TIMESTAMP 
                 WHERE UploadID = $2`,
                ['completed', scheduleId]
            );

            await client.query('COMMIT');
            res.status(201).json({ 
                message: "Exam schedule uploaded successfully",
                scheduleId,
                academicYear,
                semester,
                examType
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ 
            message: "Error processing file", 
            error: error.message 
        });
    }
};

// Get all schedules
const getSchedules = async (req, res) => {
    try {
        const result = await client.query(
            `SELECT 
                s.UploadID,
                s.AcademicYear,
                s.Semester,
                s.ExamType,
                s.UploadedAt,
                s.ProcessedAt,
                s.Status,
                s.FileName,
                u.UserID as UploaderID,
                ui.Name as UploaderName,
                ui.Email as UploaderEmail,
                ui.PhoneNum as UploaderPhone,
                (SELECT COUNT(*) FROM ExamSchedule e WHERE e.ScheduleID = s.UploadID) as ExamCount
             FROM UploadedSchedules s
             LEFT JOIN AppUser u ON s.UploadedBy = u.UserID
             LEFT JOIN UserInfo ui ON u.U_ID = ui.ID
             ORDER BY 
                s.AcademicYear DESC,
                CASE s.Semester 
                    WHEN 'First' THEN 1 
                    WHEN 'Second' THEN 2 
                    WHEN 'Summer' THEN 3 
                END,
                CASE s.ExamType
                    WHEN 'First' THEN 1
                    WHEN 'Second' THEN 2
                    WHEN 'Final' THEN 3
                END,
                s.UploadedAt DESC`
        );
        
        const schedules = result.rows.map(row => ({
            scheduleInfo: {
                uploadId: row.uploadid,
                academicYear: row.academicyear,
                semester: row.semester,
                examType: row.examtype,
                uploadedAt: row.uploadedat,
                processedAt: row.processedat,
                status: row.status,
                fileName: row.filename,
                examCount: row.examcount
            },
            uploaderInfo: {
                id: row.uploaderid,
                name: row.uploadername,
                email: row.uploaderemail,
                phone: row.uploaderphone
            }
        }));

        res.json({
            message: "Schedules retrieved successfully",
            schedules: schedules
        });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ 
            message: "Error fetching schedules", 
            error: error.message 
        });
    }
};

// Get schedule details
const getScheduleDetails = async (req, res) => {
    try {
        const { scheduleId } = req.params;

        const scheduleResult = await client.query(
            `SELECT 
                s.UploadID,
                s.AcademicYear,
                s.Semester,
                s.ExamType,
                s.UploadedAt,
                s.ProcessedAt,
                s.Status,
                s.FileName,
                ui.Name as UploaderName,
                ui.Email as UploaderEmail,
                ui.PhoneNum as UploaderPhone
             FROM UploadedSchedules s
             LEFT JOIN AppUser u ON s.UploadedBy = u.UserID
             LEFT JOIN UserInfo ui ON u.U_ID = ui.ID
             WHERE s.UploadID = $1`,
            [scheduleId]
        );

        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        const examsResult = await client.query(
            `SELECT 
                e.ExamID,
                e.ExamName,
                e.ExamType,
                e.StartTime,
                e.EndTime,
                e.ExamDate,
                e.NumOfStudents,
                e.Status as ExamStatus,
                c.CourseID,
                c.CourseName,
                c.Departement as CourseDepartment,
                r.RoomID,
                r.RoomNum,
                r.SeatingCapacity,
                oh.Name as HeadObserverName,
                os.Name as SecretaryObserverName
             FROM ExamSchedule e
             LEFT JOIN Course c ON e.CourseID = c.CourseID
             LEFT JOIN Room r ON e.RoomID = r.RoomID
             LEFT JOIN Observer oh ON e.ExamHead = oh.ObserverID
             LEFT JOIN Observer os ON e.ExamSecretary = os.ObserverID
             WHERE e.ScheduleID = $1
             ORDER BY e.ExamDate, e.StartTime`,
            [scheduleId]
        );

        const schedule = {
            scheduleInfo: {
                uploadId: scheduleResult.rows[0].uploadid,
                academicYear: scheduleResult.rows[0].academicyear,
                semester: scheduleResult.rows[0].semester,
                examType: scheduleResult.rows[0].examtype,
                uploadedAt: scheduleResult.rows[0].uploadedat,
                processedAt: scheduleResult.rows[0].processedat,
                status: scheduleResult.rows[0].status,
                fileName: scheduleResult.rows[0].filename
            },
            uploaderInfo: {
                name: scheduleResult.rows[0].uploadername,
                email: scheduleResult.rows[0].uploaderemail,
                phone: scheduleResult.rows[0].uploaderphone
            },
            exams: examsResult.rows.map(exam => ({
                examId: exam.examid,
                examName: exam.examname,
                examType: exam.examtype,
                startTime: exam.starttime,
                endTime: exam.endtime,
                examDate: exam.examdate,
                numOfStudents: exam.numofstudents,
                status: exam.examstatus,
                course: {
                    id: exam.courseid,
                    name: exam.coursename,
                    department: exam.coursedepartment
                },
                room: {
                    id: exam.roomid,
                    number: exam.roomnum,
                    capacity: exam.seatingcapacity
                },
                observers: {
                    head: exam.headobservername,
                    secretary: exam.secretaryobservername
                }
            }))
        };

        res.json({
            message: "Schedule details retrieved successfully",
            schedule
        });
    } catch (error) {
        console.error('Error fetching schedule details:', error);
        res.status(500).json({ 
            message: "Error fetching schedule details", 
            error: error.message 
        });
    }
};

// Make sure the exports include ALL functions
module.exports = {
    uploadExamSchedule,
    getSchedules,
    getScheduleDetails,
    updateExam,         // This was missing or undefined
    deleteExam,
    deleteSchedule
};
