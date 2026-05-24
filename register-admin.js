require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.js');

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      // Check if user exists
      const existingUser = await User.findOne({ username: 'neer_7007' });
      if (existingUser) {
        console.log('User already exists, removing...');
        await User.findByIdAndDelete(existingUser._id);
        console.log('Existing user removed.');
      }
      // Register new user
      await new Promise((resolve, reject) => {
        User.register(new User({ username: 'neer_7007' }), 'neer_7007', (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        });
      });
      console.log('Admin user registered successfully');
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('Error:', err);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
