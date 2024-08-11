const { db } = require('../../config/firebase');

// Function to check and clean up expired licenses
async function cleanupExpiredLicenses() {
  const now = new Date();

  try {
    // Fetch all active licenses that have an endDate and are expired
    const expiredLicensesSnapshot = await db.collection('licenses')
      .where('isActive', '==', true)
      .where('endDate', '<', now)
      .get();

    // Check if there are any expired licenses
    if (expiredLicensesSnapshot.empty) {
      console.log('No expired licenses found. Skipping cleanup.');
      
      // Introduce a delay before the next cleanup check
      await delay(10 * 60 * 1000); // 10 minutes in milliseconds
      return; // Exit the function early if no expired licenses are found
    }

    const batch = db.batch();

    expiredLicensesSnapshot.forEach(doc => {
      const licenseData = doc.data();

      // Move the license to the "used licenses" collection
      const usedLicenseRef = db.collection('used_licenses').doc(doc.id);
      batch.set(usedLicenseRef, licenseData);

      // Remove the license from the "licenses" collection
      batch.delete(doc.ref);
    });

    // Commit the batch operations
    await batch.commit();

    console.log('Expired licenses cleanup completed.');
  } catch (error) {
    // If the error is related to a missing index, log it clearly
    if (error.code === 'failed-precondition') {
      console.error('Error cleaning up expired licenses: Index required. Please create the necessary index in Firestore.');
    } else {
      console.error('Error cleaning up expired licenses:', error.message);
    }
  }

  // Continue the cleanup process after a delay
  await delay(15 * 60 * 1000); // 15 minutes in milliseconds
  cleanupExpiredLicenses(); // Recursively call the function to continue the cleanup
}

// Function to introduce a delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to start the cleanup worker
function startCleanupWorker() {
  // Run the cleanup immediately on startup
  cleanupExpiredLicenses();
}

module.exports = startCleanupWorker;
