const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
    name: { type: String, required: true },
    jobCategory: { type: String, required: true },
    country: { type: String, required: true },
    profilePicture: { type: String },
    gender: { type: String, required: true },
    personality: { type: String, required: true },
    joinDate: { type: Date, required: true },
    thoughts: { type: String, required: true }
});

module.exports = mongoose.model('NeersFriend', friendSchema);