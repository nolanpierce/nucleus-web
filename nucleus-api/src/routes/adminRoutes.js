// src/routes/adminRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../config/firebase');
const adminAuth = require('../middleware/adminAuth'); // Assuming you have adminAuth middleware

const router = express.Router();

// Route to reset a user's password
router.post('/reset-password', adminAuth, async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await userDoc.ref.update({ password: hashedPassword });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password: ' + error.message });
  }
});

// Route to reset a user's HWID
router.post('/reset-hwid', adminAuth, async (req, res) => {
  try {
    const { username, newHwid } = req.body;

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];

    // Update the user's HWID
    await userDoc.ref.update({ hwid: newHwid });

    res.status(200).json({ message: 'HWID reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset HWID: ' + error.message });
  }
});

// Route to ban a user and add their HWID to a blacklist
router.post('/ban-user', adminAuth, async (req, res) => {
  try {
    const { username } = req.body;

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Add HWID to a blacklist collection if HWID exists
    if (userData.hwid) {
      await db.collection('blacklist').doc(userData.hwid).set({ hwid: userData.hwid });
    }

    // Ban the user by updating their `isBanned` field
    await userDoc.ref.update({ isBanned: true });

    res.status(200).json({ message: `User ${username} banned successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user: ' + error.message });
  }
});

module.exports = router;
