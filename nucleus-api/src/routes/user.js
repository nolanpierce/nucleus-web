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

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, hwid } = req.body;

    // Validate the username
    const usernameRegex = /^(?!.*__)(?!.*\.\.)(?!_)[a-z0-9_]+(?<!_)$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Invalid username. It must be lowercase, contain only letters, numbers, and underscores, cannot start or end with an underscore, and cannot contain spaces or special characters.' });
    }

    // Validate the password
    const passwordRegex = /^(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Invalid password. It must be at least 8 characters long, contain at least one special character, and cannot contain spaces.' });
    }

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

    // Generate a unique random document ID
    let docId;
    let exists = true;
    while (exists) {
      docId = Math.floor(1000 + Math.random() * 9000).toString(); // Generate a random 4-digit number
      const doc = await db.collection('users').doc(docId).get();
      exists = doc.exists; // Check if the document ID already exists
    }

    // Add the user to Firestore with the generated document ID
    await db.collection('users').doc(docId).set(userData);

    res.status(201).json({ message: `User ${username} created successfully`, userId: docId });
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

//GET /api/user?username=user1 (to search by username) or GET /api/user?email=user1@example.com
router.get('/user', async (req, res) => {
  try {
    const { username, email } = req.query;

    if (!username && !email) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    let userSnapshot;

    if (username) {
      // Query the user collection by username
      userSnapshot = await db.collection('users').where('username', '==', username).get();
    } else if (email) {
      // Query the user collection by email
      userSnapshot = await db.collection('users').where('email', '==', email).get();
    }

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming usernames and emails are unique, get the first document
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

// Route to fetch user data by userId
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the user by userId
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

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

// Route to fetch userId by username or email
router.get('/userid', async (req, res) => {
  try {
    const { username, email } = req.query;

    if (!username && !email) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    let userSnapshot;

    if (username) {
      // Query the user collection by username
      userSnapshot = await db.collection('users').where('username', '==', username).get();
    } else if (email) {
      // Query the user collection by email
      userSnapshot = await db.collection('users').where('email', '==', email).get();
    }

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming usernames and emails are unique, get the first document
    const userDoc = userSnapshot.docs[0];

    res.status(200).json({ userId: userDoc.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch userId: ' + error.message });
  }
});

// Route to change password with current password verification
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'UserId, current password, and new password are required' });
    }

    // Fetch the user by userId
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Compare the current password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(currentPassword, userData.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Validate the new password
    const passwordRegex = /^(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: 'Invalid new password. It must be at least 8 characters long, contain at least one special character, and cannot contain spaces.' });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await userDoc.ref.update({ password: hashedNewPassword });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password: ' + error.message });
  }
});

// Route to change email
router.post('/change-email', async (req, res) => {
  try {
    const { currentEmail, newEmail, password } = req.body;

    if (!currentEmail || !newEmail || !password) {
      return res.status(400).json({ error: 'Current email, new email, and password are required' });
    }

    // Fetch the user by current email
    const userSnapshot = await db.collection('users').where('email', '==', currentEmail).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Check if the new email is already in use
    const newEmailSnapshot = await db.collection('users').where('email', '==', newEmail).get();
    if (!newEmailSnapshot.empty) {
      return res.status(400).json({ error: 'New email is already in use' });
    }

    // Update the email
    await userDoc.ref.update({ email: newEmail });

    res.status(200).json({ message: 'Email changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change email: ' + error.message });
  }
});

// Route to change username
router.post('/change-username', async (req, res) => {
  try {
    const { userId, newUsername, password } = req.body;

    if (!userId || !newUsername || !password) {
      return res.status(400).json({ error: 'UserId (or email), new username, and password are required' });
    }

    // Fetch the user by userId
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Validate the new username
    const usernameRegex = /^(?!.*__)(?!.*\.\.)(?!_)[a-z0-9_]+(?<!_)$/;
    if (!usernameRegex.test(newUsername)) {
      return res.status(400).json({ error: 'Invalid username. It must be lowercase, contain only letters, numbers, and underscores, cannot start or end with an underscore, and cannot contain spaces or special characters.' });
    }

    // Check if the new username is already in use
    const newUsernameSnapshot = await db.collection('users').where('username', '==', newUsername).get();
    if (!newUsernameSnapshot.empty) {
      return res.status(400).json({ error: 'New username is already in use' });
    }

    // Update the username
    await userDoc.ref.update({ username: newUsername });

    res.status(200).json({ message: 'Username changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change username: ' + error.message });
  }
});

router.get('/user-has-subscription', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Fetch the user by username
    const userSnapshot = await db.collection('users').where('username', '==', username).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];

    // Check if there are active subscriptions
    const activeSubscriptionSnapshot = await userDoc.ref.collection('subscriptions')
      .where('isActive', '==', true)
      .get();

    if (activeSubscriptionSnapshot.empty) {
      return res.status(404).json({ error: 'No active subscriptions found' });
    }

    // Get active subscriptions
    const activeSubscriptions = activeSubscriptionSnapshot.docs.map(doc => doc.data());

    // Check if any active licenses exist for the user
    const activeLicenseSnapshot = await db.collection('licenses')
      .where('username', '==', username)
      .where('isActive', '==', true)
      .get();

    if (activeLicenseSnapshot.empty) {
      return res.status(404).json({ error: 'No active licenses found' });
    }

    const activeLicenses = activeLicenseSnapshot.docs.map(doc => {
      const licenseData = doc.data();
      const isExpired = new Date(licenseData.endDate.toDate()) < new Date();

      return {
        ...licenseData,
        isExpired
      };
    });

    // Filter out expired licenses
    const validLicenses = activeLicenses.filter(license => !license.isExpired);

    if (validLicenses.length === 0) {
      return res.status(404).json({ error: 'All licenses are expired' });
    }

    // Return active subscriptions and valid licenses
    res.status(200).json({
      message: 'Valid subscription and license found',
      activeSubscriptions,
      validLicenses
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate subscription and license: ' + error.message });
  }
});


module.exports = router;

