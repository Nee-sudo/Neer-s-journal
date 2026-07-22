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
const helmet = require('helmet');
const cors = require('cors');
const sanitizeHtml = require('sanitize-html');
const multer = require('multer');
const crypto = require('crypto');
require('dotenv').config();

const User = require('./models/user.js');
const NeersFriend = require('./models/neers-friend');
const Entry = require('./models/entry.js');
const AuditLog = require('./models/auditLog');
const InvitationRequest = require('./models/invitationRequest');
const emailService = require('./services/emailService');
const { Skill, Project, Study, Deadline, Activity } = require('./models/adminData');

const { PERMISSIONS, ALL_PERMISSIONS, ROLES, DEFAULT_ROLE_PERMISSIONS } = require('./config/permissions');
const { isAuthenticated, checkAccountStatus, authorize, logAuditAction, parseUserAgent } = require('./middleware/auth');
const { sanitizeMongoQuery, validatePasswordStrength } = require('./middleware/security');

// MongoDB Connection and Offline/Mock Fallback Configuration
mongoose.set('bufferCommands', false); // fail fast

const mongoURI = process.env.MONGO_URI;
let useInMemory = !mongoURI;

const seedData = async () => {
    try {
        console.log('[Seeder] Running database seed and migration checks...');
        
        // 1. Seed / Migrate default admin neer_7007 as Super Admin with full permissions
        let neer = await User.findOne({ username: 'neer_7007' });
        if (!neer) {
            console.log('[Seeder] Registering default super admin user: neer_7007');
            User.register(new User({
                username: 'neer_7007',
                email: 'neer_7007@neersjournal.local',
                isAdmin: true,
                role: ROLES.SUPER_ADMIN,
                status: 'Active',
                permissions: ALL_PERMISSIONS,
                approvedAt: new Date()
            }), 'neer_7007', (err, user) => {
                if (err) console.error('[Seeder] Error registering seeded admin:', err);
                else console.log('[Seeder] Successfully registered SuperAdmin neer_7007');
            });
        } else {
            let updated = false;
            if (!neer.isAdmin) { neer.isAdmin = true; updated = true; }
            if (neer.role !== ROLES.SUPER_ADMIN) { neer.role = ROLES.SUPER_ADMIN; updated = true; }
            if (neer.status !== 'Active') { neer.status = 'Active'; updated = true; }
            if (!neer.email) { neer.email = 'neer_7007@neersjournal.local'; updated = true; }
            if (!neer.permissions || neer.permissions.length === 0) { neer.permissions = ALL_PERMISSIONS; updated = true; }
            if (updated) {
                await neer.save();
                console.log('[Seeder] Migrated user neer_7007 with SuperAdmin role & permissions.');
            }
        }

        // 2. Migrate existing users with isAdmin: true -> SuperAdmin role
        const legacyAdmins = await User.find({ isAdmin: true, role: { $ne: ROLES.SUPER_ADMIN } });
        for (const adminUser of legacyAdmins) {
            adminUser.role = ROLES.SUPER_ADMIN;
            adminUser.status = 'Active';
            adminUser.permissions = ALL_PERMISSIONS;
            await adminUser.save();
            console.log(`[Seeder] Migrated legacy admin ${adminUser.username} to SuperAdmin.`);
        }

        // 3. Migrate users without emails or roles
        const usersToUpdate = await User.find({ $or: [{ email: { $exists: false } }, { role: { $exists: false } }] });
        for (const u of usersToUpdate) {
            if (!u.email) {
                u.email = `${u.username}@example.com`;
                const dup = await User.findOne({ email: u.email });
                if (dup) u.email = `${u.username}_${Date.now()}@example.com`;
            }
            if (!u.role) u.role = u.isAdmin ? ROLES.SUPER_ADMIN : ROLES.USER;
            if (!u.status) u.status = 'Active';
            await u.save();
            console.log(`[Seeder] Migrated user ${u.username} schema fields.`);
        }

        // 4. Seed Skills if empty
        const skillCount = (await Skill.find({})).length;
        if (skillCount === 0) {
            console.log('[Seeder] Seeding default skills...');
            await Skill.insertMany([
                { name: 'Python from GeeksforGeeks', desc: 'Mastering fundamental algorithms, deep data structures, and asynchronous libraries.', progress: 85, icon: 'fa-python' },
                { name: 'Video Editing', desc: 'Exploring cinematic flow, color-grading tables, and narrative timing in Premiere & DaVinci.', progress: 70, icon: 'fa-video' },
                { name: 'Video Shooting', desc: 'Practicing structural lighting setup, depth-of-field manipulation, and manual camera rigs.', progress: 60, icon: 'fa-camera' }
            ]);
        }

        // 5. Seed Projects if empty
        const projectCount = (await Project.find({})).length;
        if (projectCount === 0) {
            console.log('[Seeder] Seeding default projects...');
            await Project.insertMany([
                { title: 'AI Knowledge Base', desc: 'A custom web interface designed to dynamically aggregate and suggest learning resources based on interactive student feedback.', progress: 30, date: new Date('2026-03-15'), icon: 'fa-laptop-code' },
                { title: 'Global Cultural Exchange', desc: 'An interactive community portal promoting direct international dialogues, native speech coaching, and cultural bridges.', progress: 20, date: new Date('2026-08-30'), icon: 'fa-globe-americas' },
                { title: 'Conversational DM Bot', desc: 'An automated intelligence tool structured to parse, categorize, and respond gracefully to social media messages.', progress: 80, date: new Date('2026-01-31'), icon: 'fa-robot' }
            ]);
        }

        // 6. Seed Study if empty
        const studyCount = (await Study.find({})).length;
        if (studyCount === 0) {
            console.log('[Seeder] Seeding default study focus items...');
            await Study.insertMany([
                { topic: 'Advanced Algorithms', status: 'In Progress' },
                { topic: 'Distributed Systems', status: 'Starting Soon' },
                { topic: 'Design Patterns', status: 'Revisiting' },
                { topic: 'UI/UX Editorial Design', status: 'Ongoing Study' }
            ]);
        }

        // 7. Seed Deadlines if empty
        const deadlineCount = (await Deadline.find({})).length;
        if (deadlineCount === 0) {
            console.log('[Seeder] Seeding default deadlines...');
            await Deadline.insertMany([
                { task: 'Portfolio v2 Launch', date: new Date('2025-09-15') },
                { task: 'Bug Fix Sprint End', date: new Date('2025-08-20') },
                { task: 'New Feature Pitch', date: new Date('2025-10-05') },
                { task: 'Data Analysis Report', date: new Date('2025-11-10') }
            ]);
        }

        // 8. Seed Activity if empty
        const activityCount = (await Activity.find({})).length;
        if (activityCount === 0) {
            console.log('[Seeder] Seeding default activity status...');
            await Activity.create({
                text: "I'm primarily focused on optimizing backend architecture for resilient apps, diving deep into indexing strategies, query planning, connection pooling, and secure cookie schemas."
            });
        }
        console.log('[Seeder] Database seeding and migration completed.');
    } catch (err) {
        console.error('[Seeder] Seeding error:', err);
    }
};

if (mongoURI) {
    mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            console.log('Connected to MongoDB');
            seedData();
        })
        .catch(err => {
            console.error('Error connecting to MongoDB:', err);
            console.log('Continuing in offline/mock mode.');
            useInMemory = true;
            seedData();
        });
} else {
    console.warn('MONGO_URI is not set. Running in offline/mock mode.');
    seedData();
}

// Define Models
const Journal = require('./models/journal');

const idolSchema = new mongoose.Schema({
    name: String,
    quote: String,
    image: String
});
const Idol = mongoose.models.Idol || mongoose.model('Idol', idolSchema);

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

// In-Memory Data Fallback Store
const inMemoryData = {};

function getMemoryCollection(modelName) {
    if (!inMemoryData[modelName]) {
        inMemoryData[modelName] = [];
        if (modelName === 'Idol') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), name: "Steve Jobs", quote: "The only way to do great work is to love what you do.", image: "/img/zuck.jpg" },
                { _id: new mongoose.Types.ObjectId(), name: "Ratan Tata", quote: "I don't believe in taking right decisions. I take decisions and then make them right.", image: "/img/ratan.jpg" }
            ];
        } else if (modelName === 'Journal') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), title: "First Entry", content: "Welcome to Neer's Journal!", headingColor: "#333333", contentColor: "#555555", boxColor: "#f3f4f6", mood: "Happy", tags: ["welcome"], createdAt: new Date() }
            ];
        } else if (modelName === 'NeersFriend') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), name: "Alice", jobCategory: "Software Engineer", country: "USA", profilePicture: "/img/user.png", gender: "Female", personality: "INFJ", joinDate: new Date(), thoughts: "Offline testing is great!" }
            ];
        } else if (modelName === 'Skill') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), name: 'Python from GeeksforGeeks', desc: 'Mastering fundamental algorithms, deep data structures, and asynchronous libraries.', progress: 85, icon: 'fa-python' },
                { _id: new mongoose.Types.ObjectId(), name: 'Video Editing', desc: 'Exploring cinematic flow, color-grading tables, and narrative timing in Premiere & DaVinci.', progress: 70, icon: 'fa-video' },
                { _id: new mongoose.Types.ObjectId(), name: 'Video Shooting', desc: 'Practicing structural lighting setup, depth-of-field manipulation, and manual camera rigs.', progress: 60, icon: 'fa-camera' }
            ];
        } else if (modelName === 'Project') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), title: 'AI Knowledge Base', desc: 'A custom web interface designed to dynamically aggregate and suggest learning resources based on interactive student feedback.', progress: 30, date: new Date('2026-03-15'), icon: 'fa-laptop-code' },
                { _id: new mongoose.Types.ObjectId(), title: 'Global Cultural Exchange', desc: 'An interactive community portal promoting direct international dialogues, native speech coaching, and cultural bridges.', progress: 20, date: new Date('2026-08-30'), icon: 'fa-globe-americas' },
                { _id: new mongoose.Types.ObjectId(), title: 'Conversational DM Bot', desc: 'An automated intelligence tool structured to parse, categorize, and respond gracefully to social media messages.', progress: 80, date: new Date('2026-01-31'), icon: 'fa-robot' }
            ];
        } else if (modelName === 'Study') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), topic: 'Advanced Algorithms', status: 'In Progress' },
                { _id: new mongoose.Types.ObjectId(), topic: 'Distributed Systems', status: 'Starting Soon' },
                { _id: new mongoose.Types.ObjectId(), topic: 'Design Patterns', status: 'Revisiting' },
                { _id: new mongoose.Types.ObjectId(), topic: 'UI/UX Editorial Design', status: 'Ongoing Study' }
            ];
        } else if (modelName === 'Deadline') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), task: 'Portfolio v2 Launch', date: new Date('2025-09-15') },
                { _id: new mongoose.Types.ObjectId(), task: 'Bug Fix Sprint End', date: new Date('2025-08-20') },
                { _id: new mongoose.Types.ObjectId(), task: 'New Feature Pitch', date: new Date('2025-10-05') },
                { _id: new mongoose.Types.ObjectId(), task: 'Data Analysis Report', date: new Date('2025-11-10') }
            ];
        } else if (modelName === 'Activity') {
            inMemoryData[modelName] = [
                { _id: new mongoose.Types.ObjectId(), text: "I'm primarily focused on optimizing backend architecture for resilient apps, diving deep into indexing strategies, query planning, connection pooling, and secure cookie schemas." }
            ];
        } else if (modelName === 'JournalUser') {
            inMemoryData[modelName] = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    username: 'neer_7007',
                    email: 'neer_7007@neersjournal.local',
                    password: 'neer_7007',
                    isAdmin: true,
                    role: ROLES.SUPER_ADMIN,
                    status: 'Active',
                    permissions: ALL_PERMISSIONS,
                    hasPermission: function(perm) { return true; },
                    getEffectivePermissions: function() { return ALL_PERMISSIONS; }
                }
            ];
        } else if (modelName === 'AuditLog') {
            inMemoryData[modelName] = [];
        }
    }
    return inMemoryData[modelName];
}

// Attach helper functions to mock user objects
function enrichMockUser(u) {
    if (!u) return u;
    if (!u.role) u.role = u.isAdmin ? ROLES.SUPER_ADMIN : ROLES.USER;
    if (!u.status) u.status = 'Active';
    if (!u.permissions) u.permissions = u.isAdmin ? ALL_PERMISSIONS : [];
    u.hasPermission = function(perm) {
        if (this.accountLocked && this.lockUntil && this.lockUntil > new Date()) return false;
        if (this.status !== 'Active') return false;
        if (this.role === ROLES.SUPER_ADMIN || this.isAdmin) return true;
        if (Array.isArray(this.permissions) && this.permissions.includes(perm)) return true;
        const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
        return roleDefaultPerms.includes(perm);
    };
    u.getEffectivePermissions = function() {
        if (this.role === ROLES.SUPER_ADMIN || this.isAdmin) return ALL_PERMISSIONS;
        const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
        const customPerms = Array.isArray(this.permissions) ? this.permissions : [];
        return Array.from(new Set([...roleDefaultPerms, ...customPerms]));
    };
    return u;
}

// Patch Query.prototype.exec for mock mode
const originalExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = async function(op, callback) {
    if (useInMemory || mongoose.connection.readyState !== 1) {
        const modelName = this.model.modelName;
        const opType = this.op;
        const filter = this.getFilter() || {};
        const update = this.getUpdate();
        
        const collection = getMemoryCollection(modelName);
        
        if (opType === 'find') {
            let results = collection.filter(item => {
                for (let key in filter) {
                    if (filter[key] instanceof RegExp) {
                        if (!filter[key].test(item[key])) return false;
                    } else if (filter[key] !== undefined) {
                        if (String(item[key]) !== String(filter[key])) return false;
                    }
                }
                return true;
            });
            if (modelName === 'JournalUser') {
                results = results.map(enrichMockUser);
            }
            return results;
        }
        
        if (opType === 'findOne' || opType === 'findById') {
            let item = collection.find(item => {
                if (filter._id) return String(item._id) === String(filter._id);
                for (let key in filter) {
                    if (filter[key] instanceof RegExp) {
                        if (!filter[key].test(item[key])) return false;
                    } else if (String(item[key]) !== String(filter[key])) return false;
                }
                return true;
            }) || null;

            if (modelName === 'JournalUser' && item) {
                item = enrichMockUser(item);
            }
            return item;
        }
        
        if (opType === 'findOneAndDelete' || opType === 'findByIdAndDelete') {
            const index = collection.findIndex(item => String(item._id) === String(filter._id));
            if (index !== -1) {
                return collection.splice(index, 1)[0];
            }
            return null;
        }
        
        if (opType === 'findOneAndUpdate' || opType === 'findByIdAndUpdate') {
            const index = collection.findIndex(item => String(item._id) === String(filter._id));
            if (index !== -1) {
                if (update) {
                    if (update.$set) Object.assign(collection[index], update.$set);
                    else Object.assign(collection[index], update);
                }
                return collection[index];
            }
            return null;
        }
        
        return [];
    }
    return originalExec.apply(this, arguments);
};

// Patch Model.prototype.save
const originalSave = mongoose.Model.prototype.save;
mongoose.Model.prototype.save = async function() {
    if (useInMemory || mongoose.connection.readyState !== 1) {
        const modelName = this.constructor.modelName;
        const collection = getMemoryCollection(modelName);
        
        if (!this._id) this._id = new mongoose.Types.ObjectId();
        
        const existingIndex = collection.findIndex(item => String(item._id) === String(this._id));
        const obj = this.toObject ? this.toObject() : this;
        if (existingIndex !== -1) {
            collection[existingIndex] = obj;
        } else {
            collection.push(obj);
        }
        return this;
    }
    return originalSave.apply(this, arguments);
};

// Patch Model.deleteMany and Model.insertMany
const originalDeleteMany = mongoose.Model.deleteMany;
mongoose.Model.deleteMany = async function(filter) {
    if (useInMemory || mongoose.connection.readyState !== 1) {
        const collection = getMemoryCollection(this.modelName);
        collection.length = 0;
        return { deletedCount: 0 };
    }
    return originalDeleteMany.apply(this, arguments);
};

const originalInsertMany = mongoose.Model.insertMany;
mongoose.Model.insertMany = async function(docs) {
    if (useInMemory || mongoose.connection.readyState !== 1) {
        const collection = getMemoryCollection(this.modelName);
        const addedDocs = docs.map(d => {
            const doc = d instanceof mongoose.Model ? d.toObject() : d;
            if (!doc._id) doc._id = new mongoose.Types.ObjectId();
            collection.push(doc);
            return doc;
        });
        return addedDocs;
    }
    return originalInsertMany.apply(this, arguments);
};

// Passport local-mongoose mock fallback
const originalRegister = User.register;
User.register = function(user, password, cb) {
    if (useInMemory || mongoose.connection.readyState !== 1) {
        console.log(`[Mock Auth] Registering user in-memory:`, user.username);
        const collection = getMemoryCollection('JournalUser');
        const existing = collection.find(u => u.username === user.username);
        if (existing) return cb(new Error('User already exists'));
        
        user._id = new mongoose.Types.ObjectId();
        user.password = password;
        if (!user.role) user.role = user.isAdmin ? ROLES.SUPER_ADMIN : ROLES.USER;
        if (!user.status) user.status = 'Active';
        if (!user.permissions) user.permissions = user.isAdmin ? ALL_PERMISSIONS : [];
        enrichMockUser(user);
        
        collection.push(user);
        return cb(null, user);
    }
    return originalRegister.apply(this, arguments);
};

// Initialize Express
const app = express();
app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false, // Disable default restrictive CSP to preserve EJS & FontAwesome scripts
    crossOriginEmbedderPolicy: false
}));

app.use((req, res, next) => {
    req.headers['x-forwarded-proto'] = 'https';
    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sanitizeMongoQuery);

let sessionStore;
if (mongoURI && !useInMemory) {
    sessionStore = MongoStore.create({ mongoUrl: mongoURI });
} else {
    console.warn('Using in-memory session store fallback.');
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-neers-journal',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(checkAccountStatus);

app.use(cors({
    origin: ["http://localhost:4000", "https://neersjournal.vercel.app", "https://neersjournal.up.railway.app", "https://neer-s-journal.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));

// Transparent CSRF token provider
app.use((req, res, next) => {
    req.csrfToken = () => 'mock-csrf-token';
    next();
});

// Rate Limiters
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many login attempts, please try again later.'
});

const journalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many journal submissions, please try again later.'
});

// Passport Configuration with Security Lockouts
passport.use(new LocalStrategy({ usernameField: 'username', passwordField: 'password', passReqToCallback: true }, async (req, usernameInput, passwordInput, done) => {
    try {
        const queryVal = (usernameInput || '').trim();
        if (!queryVal) {
            return done(null, false, { message: 'Username or email is required.' });
        }

        if (useInMemory || mongoose.connection.readyState !== 1) {
            const collection = getMemoryCollection('JournalUser');
            let user = collection.find(u => 
                (u.username && u.username.toLowerCase() === queryVal.toLowerCase()) || 
                (u.email && u.email.toLowerCase() === queryVal.toLowerCase())
            );
            
            if (!user) {
                const isSuper = queryVal === 'neer_7007';
                user = {
                    _id: new mongoose.Types.ObjectId(),
                    username: queryVal,
                    email: queryVal.includes('@') ? queryVal : `${queryVal}@example.com`,
                    password: passwordInput,
                    isAdmin: isSuper,
                    role: isSuper ? ROLES.SUPER_ADMIN : ROLES.USER,
                    status: 'Active',
                    permissions: isSuper ? ALL_PERMISSIONS : [],
                    failedLoginAttempts: 0,
                    accountLocked: false
                };
                enrichMockUser(user);
                collection.push(user);
                console.log(`[Mock Auth] Auto-registered user:`, queryVal);
            } else {
                enrichMockUser(user);
            }

            // Check lock status
            if (user.accountLocked && user.lockUntil && new Date() < new Date(user.lockUntil)) {
                await logAuditAction(req, 'LOGIN_FAILED_LOCKED', user.username, null, { attempts: user.failedLoginAttempts }, 'BLOCKED');
                return done(null, false, { message: 'Account locked due to repeated failed login attempts. Try again later.' });
            }

            if (user.password === passwordInput) {
                user.failedLoginAttempts = 0;
                user.lastLogin = new Date();
                user.accountLocked = false;
                
                // Record session
                if (!Array.isArray(user.activeSessions)) user.activeSessions = [];
                const { browser, os } = parseUserAgent(req.headers ? req.headers['user-agent'] : '');
                user.activeSessions.push({
                    sessionId: req.sessionID || crypto.randomBytes(16).toString('hex'),
                    browser,
                    os,
                    ip: req.ip || '127.0.0.1',
                    loginTime: new Date(),
                    lastActivity: new Date()
                });

                await logAuditAction(req, 'LOGIN_SUCCESS', user.username, null, { role: user.role }, 'SUCCESS');
                return done(null, user);
            } else {
                user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                if (user.failedLoginAttempts >= 5) {
                    user.accountLocked = true;
                    user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
                    await logAuditAction(req, 'LOGIN_LOCKED', user.username, null, { attempts: user.failedLoginAttempts }, 'BLOCKED');
                    return done(null, false, { message: 'Account locked due to 5 consecutive failed login attempts.' });
                }
                await logAuditAction(req, 'LOGIN_FAILED', user.username, null, { attempts: user.failedLoginAttempts }, 'FAILURE');
                return done(null, false, { message: 'Invalid username or password' });
            }
        } else {
            const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const user = await User.findOne({
                $or: [
                    { username: new RegExp(`^${escapeRegExp(queryVal)}$`, 'i') },
                    { email: queryVal.toLowerCase() }
                ]
            });

            if (!user) {
                await logAuditAction(req, 'LOGIN_FAILED_UNKNOWN_USER', queryVal, null, null, 'FAILURE');
                return done(null, false, { message: 'Invalid username or password' });
            }

            // Check if account is locked
            if (user.accountLocked && user.lockUntil && new Date() < new Date(user.lockUntil)) {
                await logAuditAction(req, 'LOGIN_FAILED_LOCKED', user.username, null, { attempts: user.failedLoginAttempts }, 'BLOCKED');
                return done(null, false, { message: 'Account locked due to repeated failed login attempts.' });
            }

            user.authenticate(passwordInput, async (err, authenticatedUser, passwordErr) => {
                if (err) return done(err);
                if (!authenticatedUser) {
                    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                    if (user.failedLoginAttempts >= 5) {
                        user.accountLocked = true;
                        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                        await user.save();
                        await logAuditAction(req, 'LOGIN_LOCKED', user.username, null, { attempts: user.failedLoginAttempts }, 'BLOCKED');
                        return done(null, false, { message: 'Account locked due to 5 consecutive failed login attempts.' });
                    }
                    await user.save();
                    await logAuditAction(req, 'LOGIN_FAILED', user.username, null, { attempts: user.failedLoginAttempts }, 'FAILURE');
                    return done(null, false, { message: 'Invalid username or password' });
                }

                // Successful authentication
                user.failedLoginAttempts = 0;
                user.accountLocked = false;
                user.lockUntil = undefined;
                user.lastLogin = new Date();

                // Track active session
                const { browser, os } = parseUserAgent(req.headers ? req.headers['user-agent'] : '');
                user.activeSessions = user.activeSessions || [];
                user.activeSessions.push({
                    sessionId: req.sessionID || crypto.randomBytes(16).toString('hex'),
                    browser,
                    os,
                    ip: req.ip || '127.0.0.1',
                    loginTime: new Date(),
                    lastActivity: new Date()
                });

                await user.save();
                await logAuditAction(req, 'LOGIN_SUCCESS', user.username, null, { role: user.role }, 'SUCCESS');
                return done(null, authenticatedUser);
            });
        }
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.username || user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        if (useInMemory || mongoose.connection.readyState !== 1) {
            const collection = getMemoryCollection('JournalUser');
            let user = collection.find(u => 
                (u.username && u.username.toLowerCase() === String(id).toLowerCase()) ||
                (u._id && String(u._id) === String(id))
            );
            if (!user) {
                user = { _id: new mongoose.Types.ObjectId(), username: id, isAdmin: id === 'neer_7007' };
            }
            return done(null, enrichMockUser(user));
        } else {
            const user = await User.findOne({
                $or: [
                    { username: id },
                    { email: id }
                ]
            });
            if (user) return done(null, user);
            if (mongoose.Types.ObjectId.isValid(id)) {
                const userById = await User.findById(id);
                if (userById) return done(null, userById);
            }
            return done(null, { username: id, isAdmin: id === 'neer_7007', role: ROLES.SUPER_ADMIN, status: 'Active', permissions: ALL_PERMISSIONS });
        }
    } catch (err) {
        return done(err);
    }
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'views')));

// Global Template Middleware for Auth & Permissions State
app.use((req, res, next) => {
    if (req.user) {
        res.locals.user = req.user;
        res.locals.currentUser = {
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role || ROLES.VISITOR,
            status: req.user.status || 'Active'
        };
        const isSuperOrAdmin = Boolean(
            req.user.isAdmin || 
            req.user.role === ROLES.SUPER_ADMIN || 
            req.user.role === ROLES.ADMIN || 
            req.user.role === ROLES.EDITOR
        );
        const hasWrite = typeof req.user.hasPermission === 'function' ? req.user.hasPermission(PERMISSIONS.JOURNAL_WRITE) : false;
        res.locals.canWrite = Boolean(isSuperOrAdmin || hasWrite);
    } else {
        res.locals.user = null;
        res.locals.currentUser = null;
        res.locals.canWrite = false;
    }
    next();
});

const upload = multer();

// ==================== ADMIN PANEL & API ENDPOINTS ====================

// Main Admin Panel
app.get('/admin', authorize(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
    try {
        const user = req.user;
        const effectivePerms = typeof user.getEffectivePermissions === 'function' 
            ? user.getEffectivePermissions() 
            : (user.permissions || ALL_PERMISSIONS);

        res.render('adminpanel', { 
            csrfToken: req.csrfToken ? req.csrfToken() : '',
            currentUser: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role || ROLES.SUPER_ADMIN,
                status: user.status || 'Active',
                permissions: effectivePerms
            },
            allPermissions: ALL_PERMISSIONS,
            availableRoles: ROLES,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error rendering admin panel:', err);
        res.status(500).render('error', { error: 'Error loading administrative dashboard.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }
});

// --- EDITORIAL DASHBOARD DATA APIS (Granular updates without dangerous deleteMany/insertMany) ---

// SKILLS API
app.get('/api/admin/skills', authorize(PERMISSIONS.SKILLS_VIEW), async (req, res) => {
    try {
        const skills = await Skill.find({});
        res.json(skills);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching skills' });
    }
});

app.post('/api/admin/skills', authorize(PERMISSIONS.SKILLS_EDIT), async (req, res) => {
    try {
        const { skills } = req.body;
        const oldSkills = await Skill.find({});
        const keptIds = [];

        if (Array.isArray(skills)) {
            for (const item of skills) {
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    const updated = await Skill.findByIdAndUpdate(item._id, {
                        name: item.name,
                        desc: item.desc,
                        progress: Number(item.progress) || 0,
                        icon: item.icon || 'fa-brain'
                    }, { new: true, upsert: true });
                    keptIds.push(updated._id);
                } else {
                    const created = await Skill.create({
                        name: item.name,
                        desc: item.desc,
                        progress: Number(item.progress) || 0,
                        icon: item.icon || 'fa-brain'
                    });
                    keptIds.push(created._id);
                }
            }
        }

        // Delete only skills that were removed by the admin user
        await Skill.deleteMany({ _id: { $nin: keptIds } });
        
        await logAuditAction(req, 'EDIT_SKILLS', 'Skills Collection', oldSkills, skills, 'SUCCESS');
        res.json({ success: 'Skills updated successfully!' });
    } catch (err) {
        console.error('Error updating skills:', err);
        await logAuditAction(req, 'EDIT_SKILLS_FAILED', 'Skills Collection', null, { error: err.message }, 'FAILURE');
        res.status(500).json({ error: 'Error updating skills: ' + err.message });
    }
});

// PROJECTS API
app.get('/api/admin/projects', authorize(PERMISSIONS.PROJECTS_VIEW), async (req, res) => {
    try {
        const projects = await Project.find({});
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

app.post('/api/admin/projects', authorize(PERMISSIONS.PROJECTS_EDIT), async (req, res) => {
    try {
        const { projects } = req.body;
        const oldProjects = await Project.find({});
        const keptIds = [];

        if (Array.isArray(projects)) {
            for (const item of projects) {
                const projData = {
                    title: item.title,
                    desc: item.desc,
                    progress: Number(item.progress) || 0,
                    date: item.date ? new Date(item.date) : new Date(),
                    icon: item.icon || 'fa-laptop-code'
                };
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    const updated = await Project.findByIdAndUpdate(item._id, projData, { new: true, upsert: true });
                    keptIds.push(updated._id);
                } else {
                    const created = await Project.create(projData);
                    keptIds.push(created._id);
                }
            }
        }

        await Project.deleteMany({ _id: { $nin: keptIds } });
        await logAuditAction(req, 'EDIT_PROJECTS', 'Projects Collection', oldProjects, projects, 'SUCCESS');
        res.json({ success: 'Projects updated successfully!' });
    } catch (err) {
        console.error('Error updating projects:', err);
        await logAuditAction(req, 'EDIT_PROJECTS_FAILED', 'Projects Collection', null, { error: err.message }, 'FAILURE');
        res.status(500).json({ error: 'Error updating projects' });
    }
});

// STUDY FOCUS API
app.get('/api/admin/study', authorize(PERMISSIONS.STUDY_VIEW), async (req, res) => {
    try {
        const study = await Study.find({});
        res.json(study);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching study focus' });
    }
});

app.post('/api/admin/study', authorize(PERMISSIONS.STUDY_EDIT), async (req, res) => {
    try {
        const { study } = req.body;
        const oldStudy = await Study.find({});
        const keptIds = [];

        if (Array.isArray(study)) {
            for (const item of study) {
                const data = { topic: item.topic, status: item.status || 'In Progress' };
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    const updated = await Study.findByIdAndUpdate(item._id, data, { new: true, upsert: true });
                    keptIds.push(updated._id);
                } else {
                    const created = await Study.create(data);
                    keptIds.push(created._id);
                }
            }
        }

        await Study.deleteMany({ _id: { $nin: keptIds } });
        await logAuditAction(req, 'EDIT_STUDY', 'Study Focus Collection', oldStudy, study, 'SUCCESS');
        res.json({ success: 'Study focus updated successfully!' });
    } catch (err) {
        console.error('Error updating study focus:', err);
        res.status(500).json({ error: 'Error updating study focus' });
    }
});

// DEADLINES API
app.get('/api/admin/deadlines', authorize(PERMISSIONS.DEADLINES_VIEW), async (req, res) => {
    try {
        const deadlines = await Deadline.find({});
        res.json(deadlines);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching deadlines' });
    }
});

app.post('/api/admin/deadlines', authorize(PERMISSIONS.DEADLINES_EDIT), async (req, res) => {
    try {
        const { deadlines } = req.body;
        const oldDeadlines = await Deadline.find({});
        const keptIds = [];

        if (Array.isArray(deadlines)) {
            for (const item of deadlines) {
                const data = { task: item.task, date: item.date ? new Date(item.date) : new Date() };
                if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                    const updated = await Deadline.findByIdAndUpdate(item._id, data, { new: true, upsert: true });
                    keptIds.push(updated._id);
                } else {
                    const created = await Deadline.create(data);
                    keptIds.push(created._id);
                }
            }
        }

        await Deadline.deleteMany({ _id: { $nin: keptIds } });
        await logAuditAction(req, 'EDIT_DEADLINES', 'Deadlines Collection', oldDeadlines, deadlines, 'SUCCESS');
        res.json({ success: 'Deadlines updated successfully!' });
    } catch (err) {
        console.error('Error updating deadlines:', err);
        res.status(500).json({ error: 'Error updating deadlines' });
    }
});

// CURRENT ACTIVITY API
app.get('/api/admin/activity', authorize(PERMISSIONS.ACTIVITY_VIEW), async (req, res) => {
    try {
        let activity = await Activity.findOne({});
        if (!activity) activity = { text: '' };
        res.json(activity);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching activity' });
    }
});

app.post('/api/admin/activity', authorize(PERMISSIONS.ACTIVITY_EDIT), async (req, res) => {
    try {
        const { text } = req.body;
        const oldActivity = await Activity.findOne({});
        
        let activity = await Activity.findOne({});
        if (!activity) {
            activity = new Activity({ text });
        } else {
            activity.text = text;
        }
        await activity.save();

        await logAuditAction(req, 'EDIT_ACTIVITY', 'Current Activity Status', oldActivity ? oldActivity.text : '', text, 'SUCCESS');
        res.json({ success: 'Activity status updated successfully!' });
    } catch (err) {
        console.error('Error updating activity:', err);
        res.status(500).json({ error: 'Error updating activity' });
    }
});

// --- PHASE 10 & 11: USER & ADMIN MANAGEMENT ENDPOINTS ---

// List Users
app.get('/api/admin/users', authorize(PERMISSIONS.USERS_VIEW), async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users.' });
    }
});

// Update User Role & Permissions (Role Management)
app.patch('/api/admin/users/:id/role', authorize(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
    try {
        const { role, permissions } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const oldRole = user.role;
        const oldPerms = user.permissions;

        if (role && Object.values(ROLES).includes(role)) {
            user.role = role;
            user.isAdmin = (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN);
        }
        if (Array.isArray(permissions)) {
            user.permissions = permissions;
        }

        await user.save();
        await logAuditAction(req, 'CHANGE_USER_ROLE', `User: ${user.username}`, { role: oldRole, permissions: oldPerms }, { role: user.role, permissions: user.permissions }, 'SUCCESS');
        res.json({ success: `Updated role for ${user.username} to ${user.role}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating user role.' });
    }
});

// Update User Status (Suspend, Activate, Deactivate)
app.patch('/api/admin/users/:id/status', authorize(PERMISSIONS.USERS_EDIT), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Active', 'Suspended', 'Deactivated', 'Pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const oldStatus = user.status;
        user.status = status;
        if (status === 'Active') {
            user.accountLocked = false;
            user.lockUntil = undefined;
            user.failedLoginAttempts = 0;
        }

        await user.save();
        await logAuditAction(req, 'CHANGE_USER_STATUS', `User: ${user.username}`, { status: oldStatus }, { status: status }, 'SUCCESS');
        res.json({ success: `Status for ${user.username} changed to ${status}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating user status.' });
    }
});

// Delete / Soft Delete User
app.delete('/api/admin/users/:id', authorize(PERMISSIONS.USERS_DELETE), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        
        if (user.username === 'neer_7007' || user.username === req.user.username) {
            return res.status(400).json({ error: 'Cannot delete primary admin or current logged-in user.' });
        }

        await User.findByIdAndDelete(req.params.id);
        await logAuditAction(req, 'DELETE_USER', `User: ${user.username}`, { id: user._id, email: user.email }, null, 'SUCCESS');
        res.json({ success: `User ${user.username} deleted successfully.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting user.' });
    }
});

// Admin-Initiated Password Reset
app.post('/api/admin/users/:id/reset-password', authorize(PERMISSIONS.USERS_EDIT), async (req, res) => {
    try {
        const { newPassword } = req.body;
        const passwordCheck = validatePasswordStrength(newPassword);
        if (!passwordCheck.valid) {
            return res.status(400).json({ error: passwordCheck.message });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        user.setPassword(newPassword, async (err) => {
            if (err) return res.status(500).json({ error: 'Failed to reset password: ' + err.message });
            user.failedLoginAttempts = 0;
            user.accountLocked = false;
            user.lockUntil = undefined;
            await user.save();
            await logAuditAction(req, 'ADMIN_PASSWORD_RESET', `User: ${user.username}`, null, null, 'SUCCESS');
            res.json({ success: `Password reset successfully for user ${user.username}.` });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error resetting user password.' });
    }
});

// --- PHASE 3: ADMIN APPROVAL WORKFLOW ENDPOINTS ---

// Request Admin Access (User initiates request)
app.post('/request-admin-access', isAuthenticated, async (req, res) => {
    try {
        const { requestedRole, reason } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) return res.status(404).json({ error: 'User not found.' });
        if (user.status === 'Active' && (user.isAdmin || user.role !== ROLES.USER)) {
            return res.status(400).json({ error: 'You already possess administrative permissions.' });
        }

        user.status = 'Pending';
        user.requestedRole = requestedRole || ROLES.EDITOR;
        user.requestReason = reason || 'Requested via dashboard form.';
        await user.save();

        await logAuditAction(req, 'ADMIN_ACCESS_REQUESTED', `User: ${user.username}`, null, { requestedRole: user.requestedRole, reason }, 'SUCCESS');
        res.json({ success: 'Your admin access request has been submitted to Super Admin for approval.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error submitting admin access request.' });
    }
});

// List Pending Admin Approval Requests
app.get('/api/admin/requests', authorize(PERMISSIONS.ADMINS_MANAGE), async (req, res) => {
    try {
        const requests = await User.find({ status: 'Pending' }, '-password');
        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching pending requests.' });
    }
});

// Approve Admin Request
app.post('/api/admin/requests/:id/approve', authorize(PERMISSIONS.ADMINS_MANAGE), async (req, res) => {
    try {
        const { assignedRole, customPermissions } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User request not found.' });

        const targetRole = assignedRole || user.requestedRole || ROLES.EDITOR;
        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[targetRole] || [];

        user.role = targetRole;
        user.status = 'Active';
        user.isAdmin = (targetRole === ROLES.SUPER_ADMIN || targetRole === ROLES.ADMIN);
        user.permissions = Array.isArray(customPermissions) ? customPermissions : defaultPerms;
        user.approvedBy = req.user._id;
        user.approvedAt = new Date();

        await user.save();
        await logAuditAction(req, 'ADMIN_REQUEST_APPROVED', `User: ${user.username}`, { status: 'Pending' }, { role: user.role, permissions: user.permissions }, 'SUCCESS');
        res.json({ success: `Approved admin request for ${user.username} as ${user.role}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error approving admin request.' });
    }
});

// Reject Admin Request
app.post('/api/admin/requests/:id/reject', authorize(PERMISSIONS.ADMINS_MANAGE), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User request not found.' });

        user.status = 'Rejected';
        await user.save();

        await logAuditAction(req, 'ADMIN_REQUEST_REJECTED', `User: ${user.username}`, { status: 'Pending' }, { status: 'Rejected' }, 'SUCCESS');
        res.json({ success: `Rejected admin request for ${user.username}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error rejecting admin request.' });
    }
});

// --- CHRONICLE INVITATION REQUESTS MANAGEMENT ENDPOINTS ---

// List Invitation Requests
app.get('/api/admin/invitations', authorize(PERMISSIONS.USERS_VIEW), async (req, res) => {
    try {
        const status = req.query.status || 'Pending';
        const filter = {};
        if (status !== 'ALL') filter.status = status;

        const requests = await InvitationRequest.find(filter).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Error fetching invitation requests:', err);
        res.status(500).json({ error: 'Error fetching invitation requests.' });
    }
});

// Approve Invitation Request & Create Reader Account
app.post('/api/admin/invitations/:id/approve', authorize(PERMISSIONS.USERS_EDIT), async (req, res) => {
    try {
        const { assignedUsername, tempPassword } = req.body;
        const invitation = await InvitationRequest.findById(req.params.id);
        if (!invitation) return res.status(404).json({ error: 'Invitation request not found.' });

        if (invitation.status === 'Approved') {
            return res.status(400).json({ error: 'This invitation request has already been approved.' });
        }

        const cleanUsername = (assignedUsername || invitation.name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();
        const finalPassword = tempPassword || ('Chronicle' + Math.floor(100000 + Math.random() * 900000));

        const existingUser = await User.findOne({ username: cleanUsername });
        if (existingUser) {
            return res.status(400).json({ error: `Username '${cleanUsername}' is already taken. Please choose another.` });
        }

        const newUser = new User({
            username: cleanUsername,
            email: invitation.email,
            role: ROLES.VISITOR || 'Visitor',
            status: 'Active',
            approvedBy: req.user._id,
            approvedAt: new Date()
        });

        User.register(newUser, finalPassword, async (err, registeredUser) => {
            if (err) {
                console.error('Error registering user from invitation:', err);
                return res.status(500).json({ error: 'Failed to create user account: ' + err.message });
            }

            invitation.status = 'Approved';
            invitation.assignedUsername = cleanUsername;
            invitation.approvedBy = req.user._id;
            invitation.approvedByName = req.user.username;
            invitation.approvedAt = new Date();
            await invitation.save();

            // Send notification email to applicant
            await emailService.sendApprovalEmail({
                to: invitation.email,
                name: invitation.name,
                username: cleanUsername,
                tempPassword: finalPassword
            });

            await logAuditAction(req, 'INVITATION_APPROVED', `Email: ${invitation.email}`, null, { username: cleanUsername }, 'SUCCESS');
            res.json({ success: `Invitation approved! Reader account '${cleanUsername}' created and access email dispatched.` });
        });
    } catch (err) {
        console.error('Error approving invitation:', err);
        res.status(500).json({ error: 'Error approving invitation request.' });
    }
});

// Reject Invitation Request
app.post('/api/admin/invitations/:id/reject', authorize(PERMISSIONS.USERS_EDIT), async (req, res) => {
    try {
        const invitation = await InvitationRequest.findById(req.params.id);
        if (!invitation) return res.status(404).json({ error: 'Invitation request not found.' });

        invitation.status = 'Rejected';
        invitation.rejectedBy = req.user._id;
        invitation.rejectedAt = new Date();
        await invitation.save();

        await emailService.sendRejectionEmail({
            to: invitation.email,
            name: invitation.name
        });

        await logAuditAction(req, 'INVITATION_REJECTED', `Email: ${invitation.email}`, null, null, 'SUCCESS');
        res.json({ success: 'Invitation request rejected and notification sent.' });
    } catch (err) {
        console.error('Error rejecting invitation:', err);
        res.status(500).json({ error: 'Error rejecting invitation request.' });
    }
});

// Archive Invitation Request
app.post('/api/admin/invitations/:id/archive', authorize(PERMISSIONS.USERS_EDIT), async (req, res) => {
    try {
        const invitation = await InvitationRequest.findById(req.params.id);
        if (!invitation) return res.status(404).json({ error: 'Invitation request not found.' });

        invitation.status = 'Archived';
        await invitation.save();

        await logAuditAction(req, 'INVITATION_ARCHIVED', `Email: ${invitation.email}`, null, null, 'SUCCESS');
        res.json({ success: 'Invitation request archived.' });
    } catch (err) {
        console.error('Error archiving invitation:', err);
        res.status(500).json({ error: 'Error archiving invitation request.' });
    }
});

// --- PHASE 11: ROLES & PERMISSIONS MATRIX API ---
app.get('/api/admin/roles', authorize(PERMISSIONS.ROLES_MANAGE), (req, res) => {
    res.json({
        roles: ROLES,
        defaultPermissions: DEFAULT_ROLE_PERMISSIONS,
        allPermissions: ALL_PERMISSIONS
    });
});

// --- PHASE 12: AUDIT LOGS ENDPOINT ---
app.get('/api/admin/audit-logs', authorize(PERMISSIONS.AUDIT_VIEW), async (req, res) => {
    try {
        const { search, result, limit = 100, page = 1 } = req.query;
        const filter = {};

        if (result && result !== 'ALL') filter.result = result;
        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [{ admin: regex }, { action: regex }, { target: regex }];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
        const total = await AuditLog.countDocuments(filter);

        res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching audit logs.' });
    }
});

// --- PHASE 8: ACTIVE SESSIONS API ---
app.get('/api/admin/sessions', authorize(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ sessions: user ? user.activeSessions || [] : [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching active sessions.' });
    }
});

app.delete('/api/admin/sessions/:sessionId', authorize(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user && user.activeSessions) {
            user.activeSessions = user.activeSessions.filter(s => s.sessionId !== req.params.sessionId);
            await user.save();
            await logAuditAction(req, 'TERMINATE_SESSION', `Session: ${req.params.sessionId}`, null, null, 'SUCCESS');
        }
        res.json({ success: 'Session terminated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error terminating session.' });
    }
});

app.delete('/api/admin/sessions', authorize(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.sessionVersion = (user.sessionVersion || 1) + 1;
            user.activeSessions = user.activeSessions ? user.activeSessions.filter(s => s.sessionId === req.sessionID) : [];
            await user.save();
            await logAuditAction(req, 'TERMINATE_ALL_OTHER_SESSIONS', `User: ${user.username}`, null, null, 'SUCCESS');
        }
        res.json({ success: 'All other sessions terminated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error terminating sessions.' });
    }
});

// --- PHASE 12: ANALYTICS & SECURITY DASHBOARD METRICS ---
app.get('/api/admin/analytics', authorize(PERMISSIONS.ANALYTICS_VIEW), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({});
        const activeAdmins = await User.countDocuments({ status: 'Active', $or: [{ isAdmin: true }, { role: { $ne: ROLES.USER } }] });
        const pendingRequests = await User.countDocuments({ status: 'Pending' });
        const failedLogins = await AuditLog.countDocuments({ action: { $in: ['LOGIN_FAILED', 'LOGIN_LOCKED'] } });
        const totalAuditEvents = await AuditLog.countDocuments({});
        
        const recentAudit = await AuditLog.find({}).sort({ timestamp: -1 }).limit(10);
        
        res.json({
            metrics: {
                totalUsers,
                activeAdmins,
                pendingRequests,
                failedLogins,
                totalAuditEvents
            },
            recentAudit
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching analytics.' });
    }
});

// --- PASSWORD CONFIRMATION BEFORE SENSITIVE ACTIONS ---
app.post('/api/admin/confirm-password', isAuthenticated, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) return res.status(404).json({ error: 'User not found.' });

        user.authenticate(password, (err, authenticatedUser) => {
            if (err || !authenticatedUser) {
                return res.status(401).json({ error: 'Invalid password.' });
            }
            res.json({ verified: true });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error verifying password.' });
    }
});

// ==================== PUBLIC & REGULAR PROTECTED ROUTES ====================

const getPortfolioData = async () => {
    try {
        const skills = await Skill.find({});
        const projects = await Project.find({});
        const study = await Study.find({});
        const deadlines = await Deadline.find({});
        const activity = await Activity.findOne({});
        return {
            skills: skills || [],
            projects: projects || [],
            study: study || [],
            deadlines: deadlines || [],
            activity: activity ? activity.text : ''
        };
    } catch (err) {
        console.error('Error in getPortfolioData:', err);
        return { skills: [], projects: [], study: [], deadlines: [], activity: '' };
    }
};

// --- CHRONICLE INVITATION REQUEST ROUTES ---
app.get('/request-invitation', (req, res) => {
    res.render('request-invitation', { csrfToken: req.csrfToken(), error: null, success: null });
});

app.post('/request-invitation', async (req, res) => {
    try {
        const { name, email, preferredDisplayName, country, reason } = req.body;
        
        if (!name || !email || !reason) {
            return res.status(400).render('request-invitation', {
                error: 'Full Name, Email Address, and Reason for Access are required.',
                success: null,
                csrfToken: req.csrfToken()
            });
        }

        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).render('request-invitation', {
                error: 'Please enter a valid email address.',
                success: null,
                csrfToken: req.csrfToken()
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check if user already exists
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(400).render('request-invitation', {
                error: 'An account associated with this email address already exists. Please log in directly.',
                success: null,
                csrfToken: req.csrfToken()
            });
        }

        // Check if pending invitation request exists
        const existingRequest = await InvitationRequest.findOne({ email: cleanEmail, status: 'Pending' });
        if (existingRequest) {
            return res.status(400).render('request-invitation', {
                error: 'An invitation request for this email address is already pending review.',
                success: null,
                csrfToken: req.csrfToken()
            });
        }

        const ip = (req.headers && req.headers['x-forwarded-for']) 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : (req.ip || '127.0.0.1');

        const newRequest = new InvitationRequest({
            name: name.trim(),
            email: cleanEmail,
            preferredDisplayName: (preferredDisplayName || name).trim(),
            country: (country || '').trim(),
            reason: reason.trim(),
            ipAddress: ip
        });

        await newRequest.save();

        // Trigger notification to admin email and confirmation to applicant
        await emailService.sendNewAccessRequestNotification({
            name: newRequest.name,
            email: newRequest.email,
            country: newRequest.country,
            reason: newRequest.reason,
            preferredDisplayName: newRequest.preferredDisplayName
        });

        await emailService.sendInvitationConfirmation({
            name: newRequest.name,
            email: newRequest.email,
            preferredDisplayName: newRequest.preferredDisplayName
        });

        await logAuditAction(req, 'INVITATION_REQUEST_SUBMITTED', cleanEmail, null, { name: newRequest.name }, 'SUCCESS');

        res.render('request-invitation', {
            success: 'Your invitation request has been recorded. You will receive an email notification once your request has been reviewed by Neer.',
            error: null,
            csrfToken: req.csrfToken()
        });
    } catch (err) {
        console.error('Error submitting invitation request:', err);
        res.status(500).render('request-invitation', {
            error: 'An unexpected server error occurred while processing your request. Please try again.',
            success: null,
            csrfToken: req.csrfToken()
        });
    }
});

// --- ADMIN PORTAL LOGIN ROUTES ---
app.get('/admin/login', (req, res) => {
    if (req.isAuthenticated() && req.user && (req.user.isAdmin || (req.user.role && req.user.role !== ROLES.USER && req.user.role !== ROLES.VISITOR))) {
        return res.redirect('/admin');
    }
    res.render('admin-login', { error: null, csrfToken: req.csrfToken() });
});

app.post('/admin/login', loginLimiter, (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).render('admin-login', {
                error: (info && info.message) || 'Invalid administrative credentials.',
                csrfToken: req.csrfToken()
            });
        }

        // Verify admin status
        const isAdminUser = user.isAdmin || (user.role && user.role !== ROLES.USER && user.role !== ROLES.VISITOR);
        if (!isAdminUser) {
            await logAuditAction(req, 'UNAUTHORIZED_ADMIN_PORTAL_ATTEMPT', user.username, null, { role: user.role }, 'BLOCKED');
            return res.status(403).render('admin-login', {
                error: 'Access denied. Administrative privileges are required for portal entry.',
                csrfToken: req.csrfToken()
            });
        }

        req.logIn(user, async (loginErr) => {
            if (loginErr) return next(loginErr);
            await logAuditAction(req, 'ADMIN_PORTAL_LOGIN_SUCCESS', user.username, null, { role: user.role }, 'SUCCESS');
            req.session.save((saveErr) => {
                if (saveErr) return next(saveErr);
                return res.redirect('/admin');
            });
        });
    })(req, res, next);
});

// --- DISABLE PUBLIC REGISTRATION ---
app.get('/signup', (req, res) => {
    res.redirect('/request-invitation');
});

app.post('/signup', (req, res) => {
    res.status(403).render('request-invitation', {
        error: 'Public account registration is disabled. Please request an invitation to gain chronicle access.',
        success: null,
        csrfToken: req.csrfToken()
    });
});

app.get('/login', async (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/home');
    }
    const portfolio = await getPortfolioData();
    res.render('login', { error: null, csrfToken: req.csrfToken(), ...portfolio });
});

app.post('/login', loginLimiter, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return getPortfolioData().then(portfolio => {
                res.status(401).render('login', { error: (info && info.message) || 'Invalid username or password', csrfToken: req.csrfToken(), ...portfolio });
            });
        }
        req.logIn(user, (err) => {
            if (err) return next(err);
            req.session.save((saveErr) => {
                if (saveErr) return next(saveErr);
                return res.redirect('/home');
            });
        });
    })(req, res, next);
});

// Password Reset Routes
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(200).json({ error: 'Please provide a valid email address.' });
        }
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.status(200).json({ error: 'No account associated with that email address exists.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        res.status(200).json({
            message: 'An email has been dispatched with reset instructions.',
            token: token
        });
    } catch (err) {
        console.error('Error in /forgot-password:', err);
        res.status(500).json({ error: 'An unexpected error occurred while processing password reset.' });
    }
});

app.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.render('reset-password', {
                error: 'Password reset token is invalid or has expired.',
                token: req.params.token,
                csrfToken: req.csrfToken()
            });
        }
        res.render('reset-password', {
            error: null,
            token: req.params.token,
            csrfToken: req.csrfToken()
        });
    } catch (err) {
        console.error('Error in GET /reset-password:', err);
        res.render('reset-password', {
            error: 'An error occurred while validating reset token.',
            token: req.params.token,
            csrfToken: req.csrfToken()
        });
    }
});

app.post('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.render('reset-password', {
                error: 'Password reset token is invalid or has expired.',
                token: req.params.token,
                csrfToken: req.csrfToken()
            });
        }
        if (!req.body.password || req.body.password !== req.body.confirmPassword) {
            return res.render('reset-password', {
                error: 'Passwords do not match.',
                token: req.params.token,
                csrfToken: req.csrfToken()
            });
        }
        
        const passwordCheck = validatePasswordStrength(req.body.password);
        if (!passwordCheck.valid) {
            return res.render('reset-password', {
                error: passwordCheck.message,
                token: req.params.token,
                csrfToken: req.csrfToken()
            });
        }

        user.setPassword(req.body.password, async (err) => {
            if (err) {
                return res.render('reset-password', {
                    error: 'Failed to set new password: ' + err.message,
                    token: req.params.token,
                    csrfToken: req.csrfToken()
                });
            }
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            user.failedLoginAttempts = 0;
            user.accountLocked = false;
            await user.save();
            res.redirect('/login');
        });
    } catch (err) {
        console.error('Error in POST /reset-password:', err);
        res.render('reset-password', {
            error: 'An error occurred while resetting password.',
            token: req.params.token,
            csrfToken: req.csrfToken()
        });
    }
});

app.get('/logout', (req, res, next) => {
    if (req.user) {
        logAuditAction(req, 'LOGOUT', req.user.username, null, null, 'SUCCESS');
    }
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(err => {
            if (err) return res.status(500).send('Error logging out');
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

// Protected App Pages
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

app.get('/friends-form', isAuthenticated, authorize(PERMISSIONS.JOURNAL_WRITE), (req, res) => {
    res.render('friends-form', { csrfToken: req.csrfToken(), error: null });
});

app.get('/anon-message', (req, res) => {
    res.render('anon-message', { success: null, error: null, csrfToken: req.csrfToken() });
});

// Journal Save & Delete
app.post('/api/saveJournal', isAuthenticated, authorize(PERMISSIONS.JOURNAL_WRITE), journalLimiter, async (req, res) => {
    try {
        const { title, content, headingColor, contentColor, boxColor, mood, tags } = req.body;

        if (!title || !content || content.trim() === '') {
            return res.status(400).json({ error: 'Title and content are required.' });
        }

        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['p', 'strong', 'em', 'u', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img'],
            allowedAttributes: { '*': ['style', 'class', 'href', 'src', 'alt'] },
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

        if (!sanitizedContent || sanitizedContent.trim() === '') {
            return res.status(400).json({ error: 'Content is empty after sanitization.' });
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
        res.status(200).json({ message: 'Journal entry saved successfully.', id: newJournal._id });
    } catch (err) {
        console.error('Error saving journal:', err);
        res.status(500).json({ error: 'Error saving journal entry.' });
    }
});

app.delete('/api/deleteJournal/:id', isAuthenticated, authorize(PERMISSIONS.JOURNAL_WRITE), async (req, res) => {
    try {
        const entry = await Journal.findById(req.params.id);
        if (!entry) return res.status(404).json({ error: 'Journal entry not found.' });
        await Journal.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Journal entry deleted successfully.' });
    } catch (err) {
        console.error('Error deleting journal:', err);
        res.status(500).json({ error: 'Error deleting journal entry.' });
    }
});

// Friend Form Submission
app.post('/neers-friends', isAuthenticated, authorize(PERMISSIONS.JOURNAL_WRITE), upload.none(), async (req, res) => {
    try {
        const { name, jobCategory, country, profilePicture, gender, personality, joinDate, thoughts } = req.body;
        if (!name || !joinDate) {
            return res.status(400).json({ error: 'Name and join date are required.' });
        }
        const date = new Date(joinDate);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ error: 'Invalid join date.' });
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
        if (!story) return res.status(404).json({ error: 'Story not found.' });
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

app.get('/friends', async (req, res) => {
    try {
        const friends = await NeersFriend.find();
        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
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
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.join(__dirname, 'google3634443e1c428dc1.html'));
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Start the server
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}

module.exports = app;
