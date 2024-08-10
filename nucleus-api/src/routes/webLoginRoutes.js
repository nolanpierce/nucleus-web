// src/routes/webLoginRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../config/firebase');

const router = express.Router();

// Route to handle web login
router.post('/login-web', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Fetch the user by email
    const userSnapshot = await db.collection('users').where('email', '==', email).get();

    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Check if the user is banned
    if (userData.isBanned) {
      return res.status(403).json({ error: 'User is banned' });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Fetch active subscriptions
    const subscriptionsSnapshot = await userDoc.ref.collection('subscriptions').where('isActive', '==', true).get();
    const activeSubscriptions = subscriptionsSnapshot.docs.map(doc => doc.data());

    res.status(200).json({
      message: 'Login successful',
      userId: userDoc.id,
      username: userData.username,
      activeSubscriptions
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

module.exports = router;
