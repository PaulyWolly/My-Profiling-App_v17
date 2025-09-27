const config = require('../secrets/config.json');
const mongoose = require('mongoose');
const connectionOptions = { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
};

// Initialize mongoose models
const User = require('../users/user.model');

module.exports = {
    User: User,
    isValidId
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
} 