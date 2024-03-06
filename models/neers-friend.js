// Data from Neer friends form
const mongoose = require('mongoose');

const neersFriendSchema = new mongoose.Schema({
    name:String,
    jobCategory: String,
    country: String,
    profilePicture: String,
    gender: String,
    personality: String,
    joinDate: Date,
    thoughts: String
});

const NeersFriend = mongoose.model('NeersFriend', neersFriendSchema);

module.exports = NeersFriend;
