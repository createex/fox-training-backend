const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Ensure the correct path
const config = require("../config/config"); // Ensure this path is correct

const auth = async (req, res, next) => {
  // Extract the token from the Authorization header
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Authentication token is required" });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, config.JWT_SECRET);

    console.log("Decoded token:", decoded); // Debug: log the decoded token

    // Ensure 'userId' matches with the key used in the token
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach the user object to the request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error); // Detailed error logging
    return res.status(401).json({ message: "Please authenticate" });
  }
};

module.exports = auth;
