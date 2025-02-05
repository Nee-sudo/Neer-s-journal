const express = require('express');
const ejs = require('ejs');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user.js');
const NeersFriend = require('./models/neers-friend'); // Already defined
const Entry = require('./models/entry.js');
const bodyParser = require('body-parser');
const cors = require('cors'); require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/neers-journal';

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));
//   console.log('Mongo URI:', process.env.MONGO_URI);


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
const corsOptions = {
    origin: 'https://neersjournal.vercel.app', // Replace with your Vercel frontend URL
    credentials: true,
};
app.use(cors(corsOptions));

// Passport.js configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'views' directory
app.use(express.static(path.join(__dirname, 'views')));

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/login');
    }
};

// Routes
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/about', (req, res) => {
    res.render('about');
});
app.get('/anonmessage', (req, res) => {
    res.render('anonmessage');
});


app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    User.register(new User({ username: username }), password, (err, user) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error registering user');
        } else {
            res.redirect('/login');
        }
    });
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/home',  // Redirect to /home after successful login
    failureRedirect: '/login'
}));

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login');
});

// Protected Routes
app.get('/home', isAuthenticated, (req, res) => {
    Entry.find({}).then((entries) => {
        res.render('home', { entries: entries });
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error retrieving entries');
    });
});
//accessible without /home
app.get('/', isAuthenticated, (req, res) => {
    Entry.find({}).then((entries) => {
        res.render('home', { entries: entries });
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error retrieving entries');
    });
});

app.get('/diary', isAuthenticated, (req, res) => {
    res.render('entries');
});

app.get('/projects', isAuthenticated, (req, res) => {
    res.render('projects');
});

app.get('/friendslist', isAuthenticated, (req, res) => {
    res.render('friends');
});

app.get('/idols', isAuthenticated, (req, res) => {
    res.render('inspirations');
});

app.get('/friends-form', isAuthenticated, (req, res) => {
    res.render('friends-form');
});

// Define the Friend model
const friendSchema = new mongoose.Schema({
    name: String,
    jobCategory: String,
    country: String,
    profilePicture: String,
    gender: String,
    personality: String,
    joinDate: Date,
    thoughts: String
});
const Friend = mongoose.model('Friend', friendSchema);

// Form submission route
app.post('/neers-friends', async (req, res) => {
    try {
        const { name, jobCategory, country, profilePicture, gender, personality, joinDate, thoughts } = req.body;

        const newNeersFriend = new NeersFriend({
            name,
            jobCategory,
            country,
            profilePicture,
            gender,
            personality,
            joinDate,
            thoughts
        });

        await newNeersFriend.save();
        res.status(201).json({ message: 'Form submitted successfully' });
    } catch (error) {
        console.error('Error submitting form', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Fetch all friend details
app.get('/friends', async (req, res) => {
    try {
        const friends = await NeersFriend.find();  // Change 'Friend' to 'NeersFriend'
        console.log(friends);
        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Define the Text model
const textSchema = new mongoose.Schema({
    content: String
});
const Text = mongoose.model('Text', textSchema);

// Save text route
app.post('/api/saveText', async (req, res) => {
    const content = req.body.content;

    try {
        const newText = new Text({ content });
        await newText.save();
        res.status(200).send('Text saved successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Get all texts route
app.get('/api/getAllTexts', async (req, res) => {
    try {
        const allTexts = await Text.find();
        res.json(allTexts);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
                                    //Anonymos message code 
// Connect to MongoDB

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Define Message Schema
const messageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

// Route for rendering the EJS file
app.get('/anon-message', (req, res) => {
    res.render('anon-message'); // Render the EJS file
});

// Handle Form Submission
app.post("/send-message", async (req, res) => {
    try {
        const newMessage = new Message({ content: req.body.message });
        console.log(newMessage);
        await newMessage.save();
        res.send("<h1>Message Sent Successfully!</h1><a href='/'>Go Back</a>");
    } catch (error) {
        res.status(500).send("Error saving message. Please try again later.");
    }
});

//google route 
app.get('/google3634443e1c428dc1.html', (req, res) => {
    const filePath = path.join(__dirname, 'google3634443e1c428dc1.html'); // Path to a local PDF
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
});
//sitemap
app.get('/sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'sitemap.xml'); 
    res.sendFile(filePath);
  });
// Start the server
app.listen(4000, () => {
    console.log('Server started on port 4000');
});
