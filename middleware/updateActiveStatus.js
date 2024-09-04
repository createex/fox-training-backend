const User = require("../models/user");

const updateUserActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log("uuuuuuuuuuuuuuuuuuuuser", userId);

    // Update the last active timestamp
    await User.findOneAndUpdate({ _id: userId }, { lastActiveAt: new Date() });

    next();
  } catch (error) {
    console.error("Error updating user activity:", error);
    next();
  }
};

module.exports = updateUserActivity;
