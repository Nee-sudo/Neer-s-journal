const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema;
const { ROLES, DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

const activeSessionSchema = new Schema({
    sessionId: String,
    browser: String,
    os: String,
    ip: String,
    country: String,
    loginTime: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new Schema({
    username: String,
    password: String,
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, 'Please fill a valid email address']
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.USER
    },
    permissions: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['Pending', 'Active', 'Suspended', 'Deactivated', 'Rejected'],
        default: 'Active'
    },
    requestedRole: String,
    requestReason: String,
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'JournalUser'
    },
    approvedAt: Date,
    lastLogin: Date,
    lastActivity: Date,
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    accountLocked: {
        type: Boolean,
        default: false
    },
    lockUntil: Date,
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    sessionVersion: {
        type: Number,
        default: 1
    },
    activeSessions: [activeSessionSchema],
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true
});

userSchema.plugin(passportLocalMongoose);

// Helper method to check if user has a permission
userSchema.methods.hasPermission = function(permission) {
    if (this.accountLocked && this.lockUntil && this.lockUntil > new Date()) {
        return false;
    }
    if (this.status !== 'Active') {
        return false;
    }
    if (this.role === ROLES.SUPER_ADMIN || this.isAdmin) {
        return true;
    }
    if (Array.isArray(this.permissions) && this.permissions.includes(permission)) {
        return true;
    }
    const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
    return roleDefaultPerms.includes(permission);
};

// Helper method to sync effective permissions
userSchema.methods.getEffectivePermissions = function() {
    if (this.role === ROLES.SUPER_ADMIN || this.isAdmin) {
        const { ALL_PERMISSIONS } = require('../config/permissions');
        return ALL_PERMISSIONS;
    }
    const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
    const customPerms = Array.isArray(this.permissions) ? this.permissions : [];
    return Array.from(new Set([...roleDefaultPerms, ...customPerms]));
};

module.exports = mongoose.model('JournalUser', userSchema);
