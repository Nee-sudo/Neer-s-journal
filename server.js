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
const cors = require('cors');
const sanitizeHtml = require('sanitize-html');
const multer = require('multer'); // Add multer for form-data handling
require('dotenv').config();

// MongoDB Connectionpr

const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));
console.log('Mongo URI:', process.env.MONGO_URI);

// Define Models
const Journal = require('./models/journal');

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
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Ensure JSON parsing is enabled
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({
    origin: ["http://localhost:4000", "https://neersjournal.vercel.app", "https://neersjournal.up.railway.app", "https://neer-s-journal.onrender.com"],
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(csurf());

// CSRF Error Handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('CSRF Error:', err);
        return res.status(403).json({ error: 'Invalid CSRF token. Please refresh and try again.' });
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

// Multer configuration for file uploads (optional, can be adjusted)
const upload = multer();

// Routes
app.get('/signup', (req, res) => {
    res.render('signup', { csrfToken: req.csrfToken(), error: null });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null, csrfToken: req.csrfToken() });
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render('signup', { error: 'Username already exists. Please choose a different username.', csrfToken: req.csrfToken() });
        }
        User.register(new User({ username }), password, (err, user) => {
            if (err) {
                console.error(err);
                res.status(500).render('signup', { error: 'Error registering user', csrfToken: req.csrfToken() });
            } else {
                res.redirect('/login');
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('signup', { error: 'Error registering user', csrfToken: req.csrfToken() });
    }
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
        console.log('Raw req.body:', req.body);
        const { title, content, headingColor, contentColor, boxColor, mood, tags } = req.body;

        if (!title || !content || content.trim() === '') {
            console.log('Validation failed - title:', title, 'content:', content);
            return res.status(400).json({ error: 'Title and content are required.' });
        }

        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'strong', 'em', 'u', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img'],
            allowedAttributes: {
                '*': ['style', 'class', 'href', 'src', 'alt']
            },
            allowedStyles: {
                '*': {
                    'color': [/^#[0-9a-fA-F]{6}$/, /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/],
                    'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
                    'background-color': [/^#[0-9a-fA-F]{6}$/, /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/],
                    'font-size': [/^\d+(px|em|rem|%)$/],
                    'font-family': [/^[a-zA-Z\s,-]+$/]
                }
            }
        });
        console.log('Sanitized Content:', sanitizedContent);

        if (!sanitizedContent || sanitizedContent.trim() === '') {
            return res.status(400).json({ error: 'Content is empty after sanitization. Please use allowed tags and styles.' });
        }

        const newJournal = new Journal({
            title,
            content: sanitizedContent,
            headingColor: headingColor || '#333333',
            contentColor: contentColor || '#333333',
            boxColor: boxColor || '#ffffff',
            mood: mood || 'Okay',
            tags: tags || []
        });
        await newJournal.save();
        console.log('Journal entry saved:', newJournal);
        res.status(200).json({ message: 'Journal entry saved successfully.', id: newJournal._id });
    } catch (err) {
        console.error('Error saving journal:', err);
        res.status(500).json({ error: 'Error saving journal entry.' });
    }
});

// Delete Journal Entry
app.delete('/api/deleteJournal/:id', isAuthenticated, async (req, res) => {
    try {
        const entry = await Journal.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found.' });
        }
        await Journal.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Journal entry deleted successfully.' });
    } catch (err) {
        console.error('Error deleting journal:', err);
        res.status(500).json({ error: 'Error deleting journal entry.' });
    }
});

// Friend Form Submission
app.post('/neers-friends', isAuthenticated, upload.none(), async (req, res) => { // Use upload.none() for form-data without files
    try {
        console.log('Raw req.body for friend:', req.body);
        const { name, jobCategory, country, profilePicture, gender, personality, joinDate, thoughts } = req.body;

        // Validate required fields
        if (!name || !joinDate) {
            console.log('Validation failed - name:', name, 'joinDate:', joinDate);
            return res.status(400).json({ error: 'Name and join date are required.' });
        }

        // Validate joinDate
        const date = new Date(joinDate);
        if (isNaN(date.getTime())) {
            console.log('Invalid joinDate format:', joinDate);
            return res.status(400).json({ error: 'Invalid join date. Please select a valid date.' });
        }

        const newNeersFriend = new NeersFriend({
            name,
            jobCategory: jobCategory || '',
            country: country || '',
            profilePicture: profilePicture || 'https://via.placeholder.com/300x150?text=No+Image',
            gender: gender || '',
            personality: personality || '',
            joinDate: date,
            thoughts: thoughts || ''
        });
        await newNeersFriend.save();
        console.log('Friend saved:', newNeersFriend);
        res.status(200).json({ message: 'Friend added successfully.' });
    } catch (error) {
        console.error('Error submitting friend form:', error);
        res.status(500).json({ error: 'Error submitting friend form.' });
    }
});

// Comment Route
app.post('/comment/:id', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const story = await LifeSaved.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ error: 'Story not found.' });
        }
        story.comments.push({ user: req.user.username, content });
        await story.save();
        res.status(200).json({ message: 'Comment posted successfully.' });
    } catch (err) {
        console.error('Error posting comment:', err);
        res.status(500).json({ error: 'Error posting comment.' });
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

// Text Routes (likely unused, but kept for compatibility)
app.post('/api/saveText', async (req, res) => {
    try {
        const newText = new Journal({ content: req.body.content });
        await newText.save();
        res.status(200).json({ message: 'Text saved successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/getAllTexts', async (req, res) => {
    try {
        const allTexts = await Journal.find();
        res.json(allTexts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
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