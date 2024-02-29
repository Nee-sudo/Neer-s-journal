const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const entrySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    text: String
});

module.exports = mongoose.model('Entry', entrySchema);
