const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../../config/firebase');

const router = express.Router();


// Route to handle user login
router.post('/login', async (req, res) => {
  try {
    const { email, password, hwid, applicationType } = req.body;

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

    // Check HWID if the request is from the client
    if (applicationType === 'client') {
      if (!hwid) {
        return res.status(400).json({ error: 'HWID is required for client login' });
      }

      if (userData.hwid && userData.hwid !== hwid) {
        return res.status(403).json({ error: 'HWID does not match' });
      }

      // Update HWID if it's not already set
      if (!userData.hwid) {
        await userDoc.ref.update({ hwid });
      }
    }

    // Update the last active timestamp
    await userDoc.ref.update({
      isActive: true,
      lastActivity: new Date()
    });

    res.status(200).json({
      message: 'Login successful',
      username: userData.username,
      applicationType
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// Route to handle user registration
// Route to handle user registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, hwid } = req.body;

    // Check if the email already exists
    const emailSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    // Check if the username already exists
    const usernameSnapshot = await db.collection('users').where('username', '==', username).get();
    if (!usernameSnapshot.empty) {
      return res.status(400).json({ error: 'Username is already in use' });
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
      lastActive: new Date(), // Set lastActive to the current date and time
      isBanned: false,
      uacLevel: 0  // Default UAC level set to 0 for normal customers
    };

    // Add the user to Firestore
    const userRef = await db.collection('users').add(userData);

    res.status(201).json({ message: `User ${username} created successfully`, userId: userRef.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user: ' + error.message });
  }
});

// Route to change user access level (UAC)
router.post('/change-uac', async (req, res) => {
  try {
    const { username, uacLevel } = req.body;

    if (!username || uacLevel === undefined) {
      return res.status(400).json({ error: 'Username and UAC level are required' });
    }

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];

    // Update the user's UAC level
    await userDoc.ref.update({ uacLevel });

    res.status(200).json({ message: `User ${username}'s access level updated to ${uacLevel}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user access level: ' + error.message });
  }
});

// Route to fetch user access level (UAC)
router.get('/fetch-uac/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    res.status(200).json({ uacLevel: userData.uacLevel });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user access level: ' + error.message });
  }
});

// Route to validate user access level (UAC)
router.post('/validate-uac', async (req, res) => {
  try {
    const { username, requiredUacLevel } = req.body;

    if (!username || requiredUacLevel === undefined) {
      return res.status(400).json({ error: 'Username and required UAC level are required' });
    }

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.uacLevel >= requiredUacLevel) {
      res.status(200).json({ message: 'User has the required access level' });
    } else {
      res.status(403).json({ error: 'User does not have the required access level' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate user access level: ' + error.message });
  }
});

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
  

//update user activity status
router.post('/update-activity', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];

    // Update lastActivity and ensure isActive is true
    await userDoc.ref.update({
      lastActivity: new Date(),
      isActive: true
    });

    res.status(200).json({ message: 'User activity updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user activity: ' + error.message });
  }
});


// Route to fetch the count of current active users
router.get('/active-users', async (req, res) => {
  try {
    // Query the users collection for all users where isActive is true
    const activeUsersSnapshot = await db.collection('users')
      .where('isActive', '==', true)
      .get();

    // Return the count of active users as an integer
    res.status(200).json({ count: activeUsersSnapshot.size });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active users count: ' + error.message });
  }
});

module.exports = router;

