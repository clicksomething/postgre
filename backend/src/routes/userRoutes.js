// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
  createUser,
  getUserProfile,
  updateUser,
  deleteUser,
  getUserById,
  getUsers,
} = require('../controllers/userController.js'); // Import the controller

// POST request to create a new user
router.post('/', createUser);

// GET request to get all users
router.get('/',getUsers );

// GET request to get a user by ID
router.get('/:id',getUserById );

// PUT request to update a user by ID
router.put('/:id', updateUser);

// DELETE request to delete a user by ID
router.delete('/:id', deleteUser);

module.exports = router;
