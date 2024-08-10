// src/routes/userRoutes.js
const express = require('express');
const { db } = require('../../config/firebase');

const router = express.Router();

// Route to fetch all data for a specified user by username
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Query the user collection by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming usernames are unique, get the first document
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Fetch the user's subscriptions
    const subscriptionsSnapshot = await userDoc.ref.collection('subscriptions').get();
    const subscriptions = subscriptionsSnapshot.docs.map(doc => doc.data());

    // Combine user data and subscriptions
    const userResponse = {
      ...userData,
      subscriptions: subscriptions
    };

    res.status(200).json(userResponse);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data: ' + error.message });
  }
});

module.exports = router;
