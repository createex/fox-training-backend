const mongoose = require('mongoose');

// Define the User schema
const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    confirmPassword: {
        type: String,
        required: true,
    }
});

module.exports = mongoose.model('User', UserSchema);
