const { db } = require('../../config/firebase');

// Function to check and update user activity periodically
async function checkUserActivity() {
  const now = new Date();
  const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds

  try {
    const usersSnapshot = await db.collection('users').get();

    usersSnapshot.forEach(async (doc) => {
      const userData = doc.data();
      const lastActivity = userData.lastActivity ? userData.lastActivity.toDate() : null;

      if (lastActivity && now - lastActivity > fifteenMinutes && userData.isActive) {
        // If the user has been inactive for more than 15 minutes, set isActive to false
        await doc.ref.update({ isActive: false });
      }
    });

    console.log('User activity check completed.');
  } catch (error) {
    console.error('Error checking user activity:', error.message);
  }
}

// Function to start the background worker
function startActivityCheckWorker() {
  // Run the activity check every 15 minutes
  const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
  setInterval(checkUserActivity, fifteenMinutes);

  // Run the check immediately on startup
  checkUserActivity();
}

module.exports = startActivityCheckWorker;
