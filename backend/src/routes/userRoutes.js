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

// Observer Routes
router.post('/observers', userObserverController.createObserver); // Create a new observer
router.get('/observers', userObserverController.getObservers);    // Get all observers
router.get('/observers/:id', userObserverController.getObserverById); // Get an observer by ID
router.put('/observers/:id', userObserverController.updateObserver); // Update an observer
router.delete('/observers/:id', userObserverController.deleteObserver); // Delete an observer

module.exports = router;
