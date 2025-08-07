const express = require('express');
const ejs = require('ejs');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const csurf = require('csurf');
const rateLimit = require('express-rate-limit');
const User = require('./models/user.js');
const NeersFriend = require('./models/neers-friend');
const Entry = require('./models/entry.js');
const bodyParser = require('body-parser');
const cors = require('cors');
const sanitizeHtml = require('sanitize-html');
require('dotenv').config();

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));
console.log('Mongo URI:', process.env.MONGO_URI);

// Define Models
const journalSchema = new mongoose.Schema({
    title: String,
    content: String,
    headingColor: String,
    contentColor: String,
    boxColor: String,
    createdAt: { type: Date, default: Date.now }
});
const Journal = mongoose.model('Journal', journalSchema);

const idolSchema = new mongoose.Schema({
    name: String,
    quote: String,
    image: String
});
const Idol = mongoose.model('Idol', idolSchema);

const commentSchema = new mongoose.Schema({
    user: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
});
const lifeSavedSchema = new mongoose.Schema({
    title: String,
    description: String,
    photo: String,
    date: { type: Date, required: true },
    comments: [commentSchema]
});
const LifeSaved = mongoose.model('LifeSaved', lifeSavedSchema);

const photoSchema = new mongoose.Schema({
    url: String,
    quote: String
});
const Photo = mongoose.model('Photo', photoSchema);

const messageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Initialize Express
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({
    origin: ["http://localhost:4000", "https://neersjournal.vercel.app", "https://neersjournal.up.railway.app","https://neer-s-journal.onrender.com"],
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(csurf());

// CSRF Error Handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('CSRF Error:', err);
        return res.status(403).render('error', { error: 'Invalid CSRF token. Please try again.', csrfToken: req.csrfToken() });
    }
    next(err);
});

// Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts, please try again later.'
});
const journalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many journal submissions, please try again later.'
});

// Passport Configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
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
    res.render('signup', { csrfToken: req.csrfToken(), error: null });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null, csrfToken: req.csrfToken() });
});

app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    User.register(new User({ username }), password, (err, user) => {
        if (err) {
            console.error(err);
            res.status(500).render('signup', { error: 'Error registering user', csrfToken: req.csrfToken() });
        } else {
            res.redirect('/login');
        }
    });
});

app.post('/login', loginLimiter, (req, res, next) => {
    console.log('Login attempt:', req.body);
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            console.log('Login failed: Invalid username or password');
            return res.status(401).render('login', { error: 'Invalid username or password', csrfToken: req.csrfToken() });
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            console.log('User logged in:', user);
            return res.redirect('/home');
        });
    })(req, res, next);
});

app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            console.error('Logout error:', err);
            return next(err);
        }
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Error logging out');
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

// Protected Routes
app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const entries = await Journal.find();
        const idols = await Idol.find();
        const friends = await NeersFriend.find();
        const lifeSaved = await LifeSaved.find();
        const photos = await Photo.find();
        res.render('home', { entries, idols, friends, lifeSaved, photos, csrfToken: req.csrfToken(), error: null });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { error: 'Error retrieving data', csrfToken: req.csrfToken() });
    }
});

app.get('/', isAuthenticated, async (req, res) => {
    try {
        const entries = await Journal.find();
        const idols = await Idol.find();
        const friends = await NeersFriend.find();
        const lifeSaved = await LifeSaved.find();
        const photos = await Photo.find();
        res.render('home', { entries, idols, friends, lifeSaved, photos, csrfToken: req.csrfToken(), error: null });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { error: 'Error retrieving data', csrfToken: req.csrfToken() });
    }
});

app.get('/diary', isAuthenticated, (req, res) => {
    res.render('entries', { csrfToken: req.csrfToken(), error: null });
});

app.get('/projects', isAuthenticated, (req, res) => {
    res.render('projects', { csrfToken: req.csrfToken(), error: null });
});

app.get('/friendslist', isAuthenticated, async (req, res) => {
    try { 
        const friends = await NeersFriend.find();
        res.render('friends', { friends, csrfToken: req.csrfToken(), error: null });
    } catch (err) {
        console.error(err);
        res.render('friends', { friends: [], error: 'Error retrieving friends', csrfToken: req.csrfToken() });
    }
});

app.get('/idols', isAuthenticated, async (req, res) => {
    try {
        const idols = await Idol.find();
        res.render('inspirations', { idols, csrfToken: req.csrfToken(), error: null });
    } catch (err) {
        console.error(err);
        res.render('inspirations', { idols: [], error: 'Error retrieving idols', csrfToken: req.csrfToken() });
    }
});

app.get('/friends-form', isAuthenticated, (req, res) => {
    res.render('friends-form', { csrfToken: req.csrfToken(), error: null });
});

app.get('/anon-message', (req, res) => {
    res.render('anon-message', { success: null, error: null, csrfToken: req.csrfToken() });
});

// Journal Routes
app.post('/api/saveJournal', isAuthenticated, journalLimiter, async (req, res) => {
    try {
        const { title, content, headingColor, contentColor, boxColor } = req.body;
        // Sanitize the content to allow only safe HTML tags
        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'strong', 'em', 'u', 'br', 'div', 'span'],
            allowedAttributes: {
                '*': ['style']
            },
            allowedStyles: {
                '*': {
                    'color': [/^#[0-9a-fA-F]{6}$/],
                    'text-align': [/^left$/, /^right$/, /^center$/],
                    'background-color': [/^#[0-9a-fA-F]{6}$/]
                }
            }
        });
        const newJournal = new Journal({ title, content: sanitizedContent, headingColor, contentColor, boxColor });
        await newJournal.save();
        res.redirect('/home#journal');
    } catch (err) {
        console.error(err);
        res.render('home', { entries: [], idols: [], friends: [], lifeSaved: [], photos: [], error: 'Error saving journal', csrfToken: req.csrfToken() });
    }
});

// Comment Route
app.post('/comment/:id', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const story = await LifeSaved.findById(req.params.id);
        story.comments.push({ user: req.user.username, content });
        await story.save();
        res.redirect('/home#life-saved');
    } catch (err) {
        console.error(err);
        res.render('home', { entries: [], idols: [], friends: [], lifeSaved: [], photos: [], error: 'Error posting comment', csrfToken: req.csrfToken() });
    }
});

// Search Route
app.get('/search', isAuthenticated, async (req, res) => {
    try {
        const query = req.query.query;
        const entries = await Journal.find({ title: new RegExp(query, 'i') });
        const friends = await NeersFriend.find({ name: new RegExp(query, 'i') });
        res.render('search', { entries, friends, query, csrfToken: req.csrfToken(), error: null });
    } catch (err) {
        console.error(err);
        res.render('search', { entries: [], friends: [], query: '', error: 'Error performing search', csrfToken: req.csrfToken() });
    }
});

// Friend Form Submission
app.post('/neers-friends', isAuthenticated, async (req, res) => {
    try {
        const { name, jobCategory, country, profilePicture, gender, personality, joinDate, thoughts } = req.body;
        
        // Validate joinDate
        if (!joinDate || isNaN(new Date(joinDate).getTime())) {
            return res.render('friends-form', { error: 'Invalid join date. Please select a valid date.', csrfToken: req.csrfToken() });
        }

        const newNeersFriend = new NeersFriend({
            name,
            jobCategory,
            country,
            profilePicture: profilePicture || 'https://via.placeholder.com/300x150?text=No+Image',
            gender,
            personality,
            joinDate: new Date(joinDate),
            thoughts
        });
        await newNeersFriend.save();
        res.redirect('/home#friends');
    } catch (error) {
        console.error('Error submitting form', error);
        res.render('friends-form', { error: 'Error submitting friend form', csrfToken: req.csrfToken() });
    }
});

// Fetch all friend details (API)
app.get('/friends', async (req, res) => {
    try {
        const friends = await NeersFriend.find();
        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Text Routes
app.post('/api/saveText', async (req, res) => {
    try {
        const newText = new Text({ content: req.body.content });
        await newText.save();
        res.status(200).send('Text saved successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/getAllTexts', async (req, res) => {
    try {
        const allTexts = await Text.find();
        res.json(allTexts);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Anonymous Message Route
app.post('/send-message', async (req, res) => {
    try {
        const newMessage = new Message({ content: req.body.message });
        await newMessage.save();
        res.render('anon-message', { success: 'Message sent successfully!', error: null, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error('Error saving message:', error);
        res.render('anon-message', { success: null, error: 'Error saving message. Please try again.', csrfToken: req.csrfToken() });
    }
});

// Static File Routes
app.get('/google3634443e1c428dc1.html', (req, res) => {
    const filePath = path.join(__dirname, 'google3634443e1c428dc1.html');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
});

app.get('/sitemap.xml', (req, res) => {
    const filePath = path.join(__dirname, 'sitemap.xml');
    res.sendFile(filePath);
});

// Start the server
app.listen(4000, () => {
    console.log('Server started on port 4000');
});