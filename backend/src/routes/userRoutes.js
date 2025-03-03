const express = require('express');
const router = express.Router();
const userObserverController = require('../controllers/userObserverController');
const { authenticateToken } = require('../middleware/authMiddleware');

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

module.exports = router;
