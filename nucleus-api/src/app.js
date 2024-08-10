const express = require('express');
const userRegisterRoutes = require('./routes/userRegisterRoutes');
const userRoutes = require('./routes/userRoutes');
const webLoginRoutes = require('./routes/webLoginRoutes');
const clientLoginRoutes = require('./routes/clientLoginRoutes');
const adminRoutes = require('./routes/adminRoutes');
const licenseRoutes = require('./routes/licenseRoutes')



const app = express();

app.use(express.json());

app.use('/api', userRegisterRoutes);

// Use the license routes
app.use('/api/licenses', licenseRoutes);

// Use the user routes
app.use('/api', userRoutes);

// Use the web login route
app.use('/api', webLoginRoutes);

// Use the client login route
app.use('/api', clientLoginRoutes);

// Use the admin routes
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
