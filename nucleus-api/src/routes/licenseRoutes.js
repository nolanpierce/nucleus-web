// src/routes/licenseRoutes.js
const express = require('express');
const { db } = require('../../config/firebase');
const { generateUniqueLicenseKey } = require('../utils/licenseGen.js');

const router = express.Router();

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
  
  



module.exports = router;
