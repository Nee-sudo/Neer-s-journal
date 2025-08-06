const mongoose = require('mongoose');
const photoSchema = new mongoose.Schema({
    url: String,
    quote: String
});
module.exports = mongoose.model('Photo', photoSchema);