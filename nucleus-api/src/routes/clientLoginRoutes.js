// src/routes/clientLoginRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../config/firebase');

const router = express.Router();

// Route to handle client (app) login
router.post('/login-client', async (req, res) => {
  try {
    const { email, password, hwid } = req.body;

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

    // If HWID is provided, validate it
    if (hwid) {
      if (hwid !== userData.hwid) {
        return res.status(400).json({ error: 'Invalid hardware ID' });
      }

      // Check if HWID is blacklisted
      const blacklistDoc = await db.collection('blacklist').doc(hwid).get();
      if (blacklistDoc.exists) {
        return res.status(403).json({ error: 'Access denied. Your hardware ID is blacklisted.' });
      }
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
