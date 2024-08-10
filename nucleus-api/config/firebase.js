var admin = require("firebase-admin");

var serviceAccount = require("./license.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const db = admin.firestore();
// Export admin and db for use in other files
module.exports = { admin, db };