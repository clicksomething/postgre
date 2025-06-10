const express = require('express');
const router = express.Router();
const userObserverController = require('../controllers/userObserverController');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Observer Routes
router.get('/observers', userObserverController.getObservers); // Get all observers
router.get('/observers/:id', userObserverController.getObserverById); // Get an observer by ID
router.post('/observers', userObserverController.createObserver); // Create a new observer
router.put('/observers/:id', userObserverController.updateObserver); // Update an observer
router.delete('/observers/:id', userObserverController.deleteObserver); // Delete an observer

// User Routes
router.post('/create', userObserverController.createUser); // Create a new user
router.get('/', userObserverController.getUsers);          // Get all users
router.get('/:id', userObserverController.getUserById);   // Get a user by ID
router.put('/:id', userObserverController.updateUser);    // Update a user
router.delete('/:id', userObserverController.deleteUser); // Delete a user

// Time Slot Routes
router.post('/timeslots', userObserverController.addTimeSlot); // Add a new time slot


// Import your controller functions and middleware
const {
    // ... your other functions
    upload, // The multer instance from the controller
    uploadObservers
} = require('../controllers/userObserverController');

// Modify the upload route to match frontend expectations
router.post('/observers/upload', 
    (req, res, next) => {
        console.log('--- UPLOAD ROUTE MIDDLEWARE ---');
        console.log('Request Headers:', req.headers);
        console.log('Request Body:', req.body);
        next();
    },
    authenticateToken, 
    (req, res, next) => {
        console.log('--- AFTER AUTH TOKEN ---');
        console.log('Authenticated User:', req.user);
        next();
    },
    authorizeAdmin,
    (req, res, next) => {
        console.log('--- AFTER AUTHORIZE ADMIN ---');
        next();
    },
    userObserverController.upload.single('file'),
    (req, res, next) => {
        console.log('--- AFTER MULTER UPLOAD ---');
        console.log('Uploaded File:', req.file);
        next();
    },
    userObserverController.uploadObservers
);

module.exports = router;
