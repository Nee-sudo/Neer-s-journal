const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user.js');
const NeersFriend = require('./models/neers-friend');
const Entry = require('./models/entry.js');
const bodyParser = require('body-parser');
const cors = require('cors');

// mongoose.connect('mongodb://localhost/my-journal-app');
mongoose.connect('mongodb+srv://neer:bjFBXFCYd00Gifiv@my-journal-app.ges8oic.mongodb.net/?retryWrites=true&w=majority');
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

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'views' directory
app.use(express.static(path.join(__dirname, 'views')));

// data from neer friends form
app.post('/neers-friends', async (req, res) => {
    try {
        const { name, jobCategory, country, profilePicture, gender, personality, joinDate, thoughts } = req.body;

        // Validate form data here if needed

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

// Define a schema for the friend details
const friendSchema = new mongoose.Schema({
    name: String,
    country: String,
    gender: String,
    personality: String,
    joinDate: Date,
    thoughts: String,
    profilePicture: String
}, { collection: 'neersfriends' });


// Define a model for the friend details
const Friend = mongoose.model('Friend', friendSchema);

// Fetch all friend details
app.get('/friends', async (req, res) => {
    try {
        const friends = await Friend.find();
        console.log(friends);
        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});



// app.get('/style.css', (req, res) => {
//     res.set('Content-Type', 'text/css');
//     res.sendFile(path.join(__dirname, 'views', 'style.css'));
// });

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('login');
    }
};

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/friends-form', (req, res) => {
    res.render('friends-form');
});

app.get('/home', (req, res) => {
    res.render('home');
});

app.get('/diary',(req,res)=>{
    res.render('entries');
});

app.get('/projects',(req,res)=>{
    res.render('projects');
})

app.get('/friendslist',(req,res)=>{
    res.render('friends');
})

app.get('/idols',(req,res)=>{
    res.render('inspirations');
})
app.get('/friends-form',(req,res)=>{
    res.render('friends-form');
})

app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    User.register(new User({ username: username }), password, (err, user) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error registering user');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login');
});

app.get('/', isAuthenticated, (req, res) => {
    Entry.find({}).then((entries) => {
        res.render('home', { entries: entries });
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error retrieving entries');
    });
});


app.get('/entries', (req, res) => {
    if (req.isAuthenticated()) {
        Entry.find({ user: req.user._id }).then(entries => {
            res.render('entries', { entries: entries });
        }).catch(err => {
            console.error(err);
            res.status(500).send('Error retrieving entries');
        });
    } else {
        res.redirect('/login');
    }
});




// Define a schema for your data
const textSchema = new mongoose.Schema({
    content: String
  });
  
  // Create a model based on the schema
  const Text = mongoose.model('Text', textSchema);
  
  // API endpoint to save text
  app.post('/api/saveText', async (req, res) => {
    const content = req.body.content;
  
    try {
      // Create a new Text document and save it to the database
      const newText = new Text({ content });
      await newText.save();
      res.status(200).send('Text saved successfully.');
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // API endpoint to get all texts
  app.get('/api/getAllTexts', async (req, res) => {
    try {
      // Retrieve all Text documents from the database
      const allTexts = await Text.find();
      res.json(allTexts);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });


app.listen(4000, () => {
    console.log('Server started on port 4000');
});
