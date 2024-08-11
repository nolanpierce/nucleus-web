const express = require('express');
const userRoutes = require('./routes/user');
const licenseRoutes = require('./routes/license')
const activityTracker = require('./middleware/tracker')
const licenseCleanup = require('./middleware/licenseCleanup')
//setting up express application
const app = express();
app.use(express.json());
//routes
app.use('/api', userRoutes);
app.use('/api/licenses', licenseRoutes);

//start our tracker for activity
activityTracker();

//start our license cleanup which will remove used licenses from user and store them in a seperate used license database file
licenseCleanup();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
