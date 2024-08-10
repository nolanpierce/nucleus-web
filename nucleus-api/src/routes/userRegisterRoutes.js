// src/routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../config/firebase');

const router = express.Router();

// Route to handle user registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, hwid } = req.body;

    // Check if the email already exists
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    // Hash the user's password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare user data
    const userData = {
      username,
      email,
      password: hashedPassword,
      hwid: hwid || null,  // Set HWID to null if not provided
      createdAt: new Date(),
      isBanned: false
    };

    // Add the user to Firestore
    const userRef = await db.collection('users').add(userData);

    res.status(201).json({ message: `User ${username} created successfully`, userId: userRef.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user: ' + error.message });
  }
});

module.exports = router;
