const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
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
  },
  totalWorkouts: { type: Number, default: 0 },
  workoutsInWeek: { type: Number, default: 0 },
  streaks: { type: Number, default: 0 },
  lastWorkoutDate: { type: Date, default: null },
  weeklyWorkOutGoal: {
    type: Number,
    default: 0,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  lastWorkoutDate: {
    type: Date,
  },
});

module.exports = mongoose.model("User", UserSchema);
