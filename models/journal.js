const mongoose = require('mongoose');
const journalSchema = new mongoose.Schema({
    title: String,
    content: String,
    headingColor: String,
    contentColor: String,
    boxColor: String,
    mood: { type: String, enum: ['Sad', 'Okay', 'Good', 'Great', 'Loved'], default: 'Okay' },
    tags: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Journal', journalSchema);
