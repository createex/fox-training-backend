const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  acheivementType: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  category: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("UserAcheivements", UserSchema);
