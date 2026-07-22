const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const auditLogSchema = new Schema({
    admin: {
        type: String,
        required: true,
        index: true
    },
    adminId: {
        type: Schema.Types.ObjectId,
        ref: 'JournalUser'
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    target: {
        type: String,
        required: true
    },
    oldValue: {
        type: Schema.Types.Mixed,
        default: null
    },
    newValue: {
        type: Schema.Types.Mixed,
        default: null
    },
    ip: {
        type: String,
        default: '127.0.0.1'
    },
    userAgent: {
        type: String,
        default: 'Unknown'
    },
    browser: String,
    os: String,
    result: {
        type: String,
        enum: ['SUCCESS', 'FAILURE', 'BLOCKED', 'WARNING'],
        default: 'SUCCESS'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
