const mongoose = require('mongoose');
const journalSchema = new mongoose.Schema({
    title: String,
    content: String,
    headingColor: String,
    contentColor: String,
    boxColor: String,
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Journal', journalSchema);