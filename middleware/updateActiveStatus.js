const User = require("../models/user");

const updateUserActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Update the last active timestamp
    await User.findOneAndUpdate(
      { _id: userId },
      { $set: { lastActiveAt: new Date() } }
    );
    console.log(new Date());

    next();
  } catch (error) {
    console.error("Error updating user activity:", error);
    next();
  }
};
module.exports = updateUserActivity;
