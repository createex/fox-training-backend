const mongoose = require("mongoose");

// Schema for exercise names
const exerciseNameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Ensures exercise names are unique
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create a model for exercise names
const ExerciseName = mongoose.model("ExerciseName", exerciseNameSchema);

module.exports = ExerciseName;
