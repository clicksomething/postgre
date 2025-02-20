const multer = require('multer');

// Configure storage
const storage = multer.memoryStorage(); // Store file in memory

// File filter for Excel files only
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
    } else {
        cb(new Error('Only Excel files are allowed!'), false);
    }
};

// Configure multer
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'File is too large. Maximum size is 5MB'
            });
        }
        return res.status(400).json({
            message: 'File upload error',
            error: err.message
        });
    }
    
    if (err.message === 'Only Excel files are allowed!') {
        return res.status(400).json({
            message: err.message
        });
    }
    
    next(err);
};

module.exports = {
    upload,
    handleUploadError
};
