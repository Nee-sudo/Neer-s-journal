const mongoose = require('mongoose');
const commentSchema = new mongoose.Schema({
    user: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
});
const lifeSavedSchema = new mongoose.Schema({
    title: String,
    description: String,
    photo: String,
    date: Date,
    comments: [commentSchema]
});
module.exports = mongoose.model('LifeSaved', lifeSavedSchema);