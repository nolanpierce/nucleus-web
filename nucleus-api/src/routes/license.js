const express = require('express');
const { db } = require('../../config/firebase.js');
const { generateUniqueLicenseKey } = require('../utilities/licenseGen.js');

const router = express.Router();

// Endpoint to generate unique licenses
// Endpoint to generate unique licenses
router.post('/generate-licenses', async (req, res) => {
  try {
    const { subscriptionName, duration, quantity } = req.body;

    if (!subscriptionName || !duration || !quantity) {
      return res.status(400).json({ error: 'Subscription name, duration (in days), and quantity are required' });
    }

    const licenses = [];

    for (let i = 0; i < quantity; i++) {
      const licenseKey = await generateUniqueLicenseKey();

      const licenseData = {
        username: null,  // Start with null username
        licenseKey,
        subscriptionName,  // Subscription name associated with this license
        duration,  // Duration in days
        isActive: false,  // License is not active until it's used
        createdAt: new Date(),
        endDate: null,  // No end date until the license is activated
        hwid: null,  // HWID is null until it's locked to a specific device
      };

      // Add the unique license to Firestore
      await db.collection('licenses').add(licenseData);

      licenses.push(licenseData);
    }

    res.status(201).json({ message: `${quantity} licenses generated successfully`, licenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate licenses: ' + error.message });
  }
});

// Endpoint to activate a license
// Endpoint to activate a license
router.post('/activate-license', async (req, res) => {
  try {
    const { username, licenseKey } = req.body;

    if (!username || !licenseKey) {
      return res.status(400).json({ error: 'Username and license key are required' });
    }

    // Fetch the license by key and ensure it's not already activated
    const licenseSnapshot = await db.collection('licenses')
      .where('licenseKey', '==', licenseKey)
      .where('isActive', '==', false) // Ensure it's not already activated
      .get();

    if (licenseSnapshot.empty) {
      return res.status(404).json({ error: 'License not found or already activated' });
    }

    const licenseDoc = licenseSnapshot.docs[0];
    const licenseData = licenseDoc.data();

    // Fetch the user document
    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (userSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Check if there's already an active subscription for the same subscription name
    const activeSubscriptionSnapshot = await userDoc.ref.collection('subscriptions')
      .where('subscriptionName', '==', licenseData.subscriptionName)
      .where('isActive', '==', true)
      .get();

    let newEndDate;

    if (!activeSubscriptionSnapshot.empty) {
      const activeSubscriptionDoc = activeSubscriptionSnapshot.docs[0];
      const activeSubscriptionData = activeSubscriptionDoc.data();

      // Extend the subscription duration
      newEndDate = new Date(activeSubscriptionData.endDate.toDate());
      newEndDate.setDate(newEndDate.getDate() + licenseData.duration);

      await activeSubscriptionDoc.ref.update({ endDate: newEndDate });
    } else {
      // If no active subscription, activate this license as a new subscription
      newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + licenseData.duration);

      await userDoc.ref.collection('subscriptions').add({
        subscriptionName: licenseData.subscriptionName,
        startDate: new Date(),
        endDate: newEndDate,
        isActive: true
      });
    }

    // Update the license with activation details
    await licenseDoc.ref.update({ isActive: true, endDate: newEndDate, username });

    // Update the user's active subscriptions in the `users` collection
    const updatedActiveSubscriptions = userData.activeSubscriptions || [];
    if (!updatedActiveSubscriptions.includes(licenseData.subscriptionName)) {
      updatedActiveSubscriptions.push(licenseData.subscriptionName);
      await userDoc.ref.update({ activeSubscriptions: updatedActiveSubscriptions });
    }

    res.status(200).json({ message: 'License activated successfully', endDate: newEndDate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate license: ' + error.message });
  }
});

// Endpoint to reset HWID for a specific license
router.post('/reset-hwid', async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ error: 'License key is required' });
    }

    const licenseSnapshot = await db.collection('licenses').where('licenseKey', '==', licenseKey).get();

    if (licenseSnapshot.empty) {
      return res.status(404).json({ error: 'License not found' });
    }

    const licenseDoc = licenseSnapshot.docs[0];

    // Reset HWID to null
    await licenseDoc.ref.update({ hwid: null });

    res.status(200).json({ message: `HWID reset successfully for license key ${licenseKey}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset HWID: ' + error.message });
  }
});

// Endpoint to retrieve licenses by subscription name using GET
router.get('/licenses-by-subscription', async (req, res) => {
  try {
    const { subscriptionName } = req.query;

    if (!subscriptionName) {
      return res.status(400).json({ error: 'Subscription name is required' });
    }

    const licensesSnapshot = await db.collection('licenses')
      .where('subscriptionName', '==', subscriptionName)
      .get();

    if (licensesSnapshot.empty) {
      return res.status(404).json({ error: 'No licenses found for this subscription' });
    }

    const licenses = licensesSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ licenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve licenses: ' + error.message });
  }
});


// Endpoint to extend a user's subscription
router.post('/extend-subscription', async (req, res) => {
  try {
    const { username, newLicenseKey } = req.body;

    if (!username || !newLicenseKey) {
      return res.status(400).json({ error: 'Username and new license key are required' });
    }

    // Fetch the user's current active license for the same subscription
    const userLicenseSnapshot = await db.collection('licenses')
      .where('username', '==', username)
      .where('isActive', '==', true)
      .get();

    if (userLicenseSnapshot.empty) {
      return res.status(404).json({ error: 'Active license not found for the user' });
    }

    const userLicenseDoc = userLicenseSnapshot.docs[0];
    const userLicenseData = userLicenseDoc.data();

    // Fetch the new license
    const newLicenseSnapshot = await db.collection('licenses')
      .where('licenseKey', '==', newLicenseKey)
      .where('isActive', '==', false) // Ensure the new license isn't already active
      .get();

    if (newLicenseSnapshot.empty) {
      return res.status(404).json({ error: 'New license key not found or already used' });
    }

    const newLicenseDoc = newLicenseSnapshot.docs[0];
    const newLicenseData = newLicenseDoc.data();

    // Check if the subscription name matches
    if (userLicenseData.subscriptionName !== newLicenseData.subscriptionName) {
      return res.status(400).json({ error: 'The new license key does not match the current subscription' });
    }

    // Extend the duration
    const newEndDate = new Date(userLicenseData.endDate.toDate());
    newEndDate.setDate(newEndDate.getDate() + newLicenseData.duration);

    // Update the current license with the extended duration
    await userLicenseDoc.ref.update({ endDate: newEndDate });

    // Delete the new license key as it's now consumed
    await newLicenseDoc.ref.delete();

    res.status(200).json({ message: 'Subscription extended successfully', newEndDate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extend subscription: ' + error.message });
  }
});

// Endpoint to fetch all licenses by username
router.get('/licenses-by-username', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const licensesSnapshot = await db.collection('licenses')
      .where('username', '==', username)
      .get();

    if (licensesSnapshot.empty) {
      return res.status(404).json({ error: 'No licenses found for this user' });
    }

    const licenses = licensesSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ licenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve licenses: ' + error.message });
  }
});

// Endpoint to delete a license from the "used licenses" collection
router.delete('/delete-used-license', async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ error: 'License key is required' });
    }

    // Find the license in the "used licenses" collection
    const licenseSnapshot = await db.collection('used_licenses')
      .where('licenseKey', '==', licenseKey)
      .get();

    if (licenseSnapshot.empty) {
      return res.status(404).json({ error: 'License not found' });
    }

    // Delete the license
    const batch = db.batch();
    licenseSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.status(200).json({ message: `License ${licenseKey} deleted successfully from used licenses.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete license: ' + error.message });
  }
});

// Endpoint to fetch all inactive licenses
router.get('/inactive-licenses', async (req, res) => {
  try {
    const inactiveLicensesSnapshot = await db.collection('licenses')
      .where('isActive', '==', false)
      .get();

    if (inactiveLicensesSnapshot.empty) {
      return res.status(404).json({ message: 'No inactive licenses found' });
    }

    const inactiveLicenses = inactiveLicensesSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ inactiveLicenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inactive licenses: ' + error.message });
  }
});


// Endpoint to fetch all active licenses
router.get('/active-licenses', async (req, res) => {
  try {
    const activeLicensesSnapshot = await db.collection('licenses')
      .where('isActive', '==', true)
      .get();

    if (activeLicensesSnapshot.empty) {
      return res.status(404).json({ message: 'No active licenses found' });
    }

    const activeLicenses = activeLicensesSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ activeLicenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active licenses: ' + error.message });
  }
});


module.exports = router;
