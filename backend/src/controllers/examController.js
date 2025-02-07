const { client } = require('../../database/db'); // Database connection

const multer = require('multer'); // For file uploads
const xlsx = require('xlsx'); // For parsing Excel files
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage });

// Function to convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial) {
    const utcDays = Math.floor(serial) - 25569; // Excel's epoch starts on 1900-01-01
    const utcValue = utcDays * 86400; // Convert days to seconds
    return new Date(utcValue * 1000); // Convert seconds to milliseconds
}

const createExam = async (req, res) => {
    const { courseId, roomId, examName, examType, examDate, duration } = req.body;

    try {
        const result = await client.query(
            `INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, ExamType, ExamDate, Duration) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [courseId, roomId, examName, examType, examDate, duration]
        );

        res.status(201).json({ message: "Exam created successfully", exam: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating exam" });
    }
};

const getAllExams = async (req, res) => {
    try {
        const result = await client.query(`SELECT * FROM ExamSchedule`);
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
    const { id } = req.params;
    const { courseId, roomId, examName, examType, examDate, duration } = req.body;

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
    if (examType) {
        query += `ExamType = $${index++}, `;
        values.push(examType);
        fieldsProvided = true;
    }
    if (examDate) {
        query += `ExamDate = $${index++}, `;
        values.push(examDate);
        fieldsProvided = true;
    }
    if (duration) {
        query += `Duration = $${index++}, `;
        values.push(duration);
        fieldsProvided = true;
    }

    // If no fields were provided, return an error
    if (!fieldsProvided) {
        return res.status(400).json({ message: "No fields provided for update" });
    }

    // Remove the last comma and space
    query = query.slice(0, -2);
    query += ` WHERE ExamID = $${index} RETURNING *`;
    values.push(id);

    try {
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }

        res.json({ message: "Exam updated successfully", exam: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating exam" });
    }
};

const deleteExam = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await client.query(`DELETE FROM ExamSchedule WHERE ExamID = $1 RETURNING *`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Exam not found" });
        }

        res.json({ message: "Exam deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting exam" });
    }
};

const uploadExamSchedule = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of sheetData) {
            const { CourseID, RoomID, ExamName, ExamType, ExamDate, Duration } = row;

            // Convert Excel date to JS Date and format for PostgreSQL
            const formattedExamDate = ExamDate ? excelDateToJSDate(ExamDate).toISOString().split('T')[0] : null;

            await client.query(
                `INSERT INTO ExamSchedule (CourseID, RoomID, ExamName, ExamType, ExamDate, Duration) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [CourseID, RoomID, ExamName, ExamType, formattedExamDate, Duration]
            );
        }

        res.status(201).json({ message: "Exam schedule uploaded successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error processing file" });
    }
};

module.exports = {
    createExam,
    getAllExams,
    getExamById,
    updateExam,
    deleteExam,
    uploadExamSchedule,
};
