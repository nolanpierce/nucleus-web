// src/middleware/adminAuth.js
const { admin } = require('../../config/firebase');

const adminAuth = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization.split('Bearer ')[1];

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check if the user is an admin
    if (decodedToken.admin === true) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Admins only.' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: ' + error.message });
  }
};

module.exports = adminAuth;
