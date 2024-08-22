const jwt = require('jsonwebtoken');
const config = require('../config/config')
// Function to generate JWT token
function generateToken(userId) {
    const payload = {
        userId: userId,
    };

    // Use a consistent and secure secret key
    const secretKey = config.JWT_SECRET; // Consider using an environment variable for this

    // Generate the token without expiration
    const token = jwt.sign(payload, secretKey);
    return token;
}

module.exports = { generateToken };


function decodeToken(req, res, next) {
    // Get token from request headers or query parameters
    const token = req.headers.authorization || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Verify and decode the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }
        // Attach the user ID to req.user
        req.user = decoded.userId;
        console.log('UserId', req.user);
        next();
    });
}

module.exports = { generateToken, decodeToken };
