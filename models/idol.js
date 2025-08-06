const mongoose = require('mongoose');
const idolSchema = new mongoose.Schema({
    name: String,
    quote: String,
    image: String
});
module.exports = mongoose.model('Idol', idolSchema);