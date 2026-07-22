const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const invitationRequestSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    preferredDisplayName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, 'Please fill a valid email address']
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        trim: true,
        default: 'Not specified'
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Archived'],
        default: 'Pending'
    },
    ip: {
        type: String,
        default: '127.0.0.1'
    },
    assignedUsername: String,
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'JournalUser'
    },
    approvedByName: String,
    approvedAt: Date
}, {
    timestamps: true
});

module.exports = mongoose.models.InvitationRequest || mongoose.model('InvitationRequest', invitationRequestSchema);
