const AuditLog = require('../models/auditLog');
const { PERMISSIONS, ROLES } = require('../config/permissions');
const mongoose = require('mongoose');

// Helper to parse User Agent
function parseUserAgent(ua = '') {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/edg/i.test(ua)) browser = 'Edge';

    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad/i.test(ua)) os = 'iOS';

    return { browser, os };
}

// Global Audit Log Function
async function logAuditAction(req, action, target = '', oldValue = null, newValue = null, result = 'SUCCESS') {
    try {
        const adminName = req.user ? (req.user.username || 'System') : 'Unauthenticated';
        const adminId = req.user ? (req.user._id || null) : null;
        const ua = req.headers ? req.headers['user-agent'] : '';
        const { browser, os } = parseUserAgent(ua);
        const ip = (req.headers && req.headers['x-forwarded-for']) 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : (req.ip || '127.0.0.1');

        const logData = {
            admin: adminName,
            adminId: adminId,
            action: action,
            target: target,
            oldValue: oldValue,
            newValue: newValue,
            ip: ip,
            userAgent: ua,
            browser: browser,
            os: os,
            result: result,
            timestamp: new Date()
        };

        if (mongoose.connection.readyState === 1) {
            await AuditLog.create(logData);
        } else {
            const auditLogModel = mongoose.model('AuditLog');
            const doc = new auditLogModel(logData);
            await doc.save();
        }
    } catch (err) {
        console.error('[AuditLog] Error saving audit record:', err.message);
    }
}

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.originalUrl.startsWith('/api/') || req.xhr || (req.headers && req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    return res.redirect('/login');
};

// Account lock and status verification middleware
const checkAccountStatus = async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
        return next();
    }

    const user = req.user;

    // Check account lock expiration
    if (user.accountLocked && user.lockUntil) {
        if (new Date() > new Date(user.lockUntil)) {
            user.accountLocked = false;
            user.lockUntil = undefined;
            user.failedLoginAttempts = 0;
            if (typeof user.save === 'function') {
                await user.save().catch(() => {});
            }
        } else {
            const timeLeft = Math.ceil((new Date(user.lockUntil) - new Date()) / 60000);
            if (req.originalUrl.startsWith('/api/') || req.xhr) {
                return res.status(423).json({ error: `Account locked due to repeated failed login attempts. Try again in ${timeLeft} minutes.` });
            }
            return res.status(423).render('error', { 
                error: `Account locked due to security policy. Please wait ${timeLeft} minutes.`,
                csrfToken: req.csrfToken ? req.csrfToken() : '' 
            });
        }
    }

    // Check account status (e.g. Pending, Suspended, Deactivated)
    if (user.status && user.status !== 'Active') {
        let msg = `Your account status is currently '${user.status}'.`;
        if (user.status === 'Pending') {
            msg = 'Your admin account request is pending approval by a Super Admin.';
        } else if (user.status === 'Suspended') {
            msg = 'Your administrative account has been suspended.';
        } else if (user.status === 'Deactivated' || user.status === 'Rejected') {
            msg = 'Your administrative access has been deactivated or rejected.';
        }

        if (req.originalUrl.startsWith('/api/') || req.xhr) {
            return res.status(403).json({ error: msg });
        }
        return res.status(403).render('error', { error: msg, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }

    // Update last activity timestamp
    user.lastActivity = new Date();
    if (typeof user.save === 'function') {
        user.save().catch(() => {});
    }

    next();
};

// RBAC Middleware: authorize(permissionOrPermissions)
const authorize = (permissions) => {
    const requiredList = Array.isArray(permissions) ? permissions : [permissions];

    return async (req, res, next) => {
        if (!req.isAuthenticated() || !req.user) {
            if (req.originalUrl.startsWith('/api/') || req.xhr) {
                return res.status(401).json({ error: 'Authentication required. Please log in.' });
            }
            return res.redirect('/login');
        }

        const user = req.user;

        // Verify account lock and active status
        if (user.accountLocked || (user.status && user.status !== 'Active')) {
            await logAuditAction(req, 'UNAUTHORIZED_ACCESS_ATTEMPT', req.originalUrl, null, { status: user.status }, 'BLOCKED');
            const msg = user.status === 'Pending' 
                ? 'Your account is pending Super Admin approval.'
                : 'Access denied. Account is inactive or locked.';
            
            if (req.originalUrl.startsWith('/api/') || req.xhr) {
                return res.status(403).json({ error: msg });
            }
            return res.status(403).render('error', { error: msg, csrfToken: req.csrfToken ? req.csrfToken() : '' });
        }

        // Check if user is SuperAdmin or has legacy isAdmin flag or has required permission
        let isPermitted = false;

        if (user.role === ROLES.SUPER_ADMIN || user.isAdmin) {
            isPermitted = true;
        } else {
            // Check each required permission
            isPermitted = requiredList.every(perm => {
                if (typeof user.hasPermission === 'function') {
                    return user.hasPermission(perm);
                }
                const effectivePerms = user.permissions || [];
                return effectivePerms.includes(perm);
            });
        }

        if (!isPermitted) {
            await logAuditAction(req, 'PERMISSION_DENIED', req.originalUrl, null, { required: requiredList, userRole: user.role }, 'BLOCKED');
            const msg = `Access denied. Required permission(s): [${requiredList.join(', ')}].`;
            
            if (req.originalUrl.startsWith('/api/') || req.xhr) {
                return res.status(403).json({ error: msg });
            }
            return res.status(403).render('error', { error: msg, csrfToken: req.csrfToken ? req.csrfToken() : '' });
        }

        next();
    };
};

module.exports = {
    isAuthenticated,
    checkAccountStatus,
    authorize,
    logAuditAction,
    parseUserAgent
};
