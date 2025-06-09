const express = require('express');
const router = express.Router();
const userObserverController = require('../controllers/userObserverController');
const authController = require('../controllers/authController'); // Import authController

// User Routes
router.post('/users/create', userObserverController.createUser); // Create a new user
router.get('/users', userObserverController.getUsers);             // Get all users
router.get('/users/:id', userObserverController.getUserById);      // Get a user by ID
router.put('/users/:id', userObserverController.updateUser);      // Update a user
router.delete('/users/:id', userObserverController.deleteUser);   // Delete a user

router.post('/login', authController.login); // Add login route

router.post('/add-time-slot', userObserverController.addTimeSlot); // Route to add a new time slot for an observer
router.post('/observers', userObserverController.createObserver); // Create a new observer
router.get('/observers', userObserverController.getObservers);    // Get all observers
router.get('/observers/:id', userObserverController.getObserverById); // Get an observer by ID
router.put('/observers/:id', userObserverController.updateObserver); // Update an observer
router.delete('/observers/:id', userObserverController.deleteObserver); // Delete an observer



// Import your controller functions and middleware
const {
    // ... your other functions
    upload, // The multer instance from the controller
    uploadObservers
} = require('../controllers/userObserverController');

// CORRECT
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware.js');

// Add the new route for bulk uploading observers
router.post(
    '/observers/upload',
    authenticateToken, // Use your existing function for checking the token
    authorizeAdmin,    // Use your existing function for checking the admin role
    upload.single('file'),
    uploadObservers
);

module.exports = router;
