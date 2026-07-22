// Anti-NoSQL injection query sanitizer
const sanitizeMongoQuery = (req, res, next) => {
    const cleanObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key.startsWith('$')) {
                    delete obj[key];
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    cleanObject(obj[key]);
                }
            }
        }
        return obj;
    };

    if (req.body) cleanObject(req.body);
    if (req.query) cleanObject(req.query);
    if (req.params) cleanObject(req.params);

    next();
};

// Password Strength Validator
const validatePasswordStrength = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password must be a non-empty string.' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        return { valid: false, message: 'Password must contain both letters and numbers.' };
    }
    return { valid: true };
};

module.exports = {
    sanitizeMongoQuery,
    validatePasswordStrength
};
