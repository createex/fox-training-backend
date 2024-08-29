const mongoose = require("mongoose");

// Schema for individual sets
const setSchema = new mongoose.Schema({
  previous: {
    type: Number,
    required: true,
    min: [0, "Previous weight cannot be negative"], // Ensure non-negative
  },
  lbs: {
    type: Number,
    required: true,
    min: [0, "Weight cannot be negative"], // Ensure non-negative
  },
  reps: {
    type: Number,
    required: true,
    min: [1, "Reps must be at least 1"], // Ensure positive number
  },
});

// Schema for each station
const stationSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: true,
    trim: true,
  },
  sets: {
    type: [setSchema],
    required: true,
    validate: [arrayLimit, "{PATH} must have at least one set"],
  },
});

// Main schema for user workout logs
const workoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program",
    required: true,
  },
  weekNumber: {
    type: Number,
    required: true,
    min: [1, "Week number cannot be less than 1"],
    max: [4, "Week number cannot be greater than 4"], // Validation for week number
  },
  workOutId: { type: mongoose.Schema.Types.ObjectId, required: true },
  stations: {
    type: [stationSchema],
    required: true,
    validate: {
      validator: function (v) {
        // Validation to ensure that stations array has valid number of stations
        return v.length === this.numberOfStations;
      },
      message: (props) =>
        `Number of stations provided (${props.value.length}) does not match the expected number!`,
    },
  },
  numberOfStations: {
    type: Number,
    required: true,
    min: [1, "There must be at least one station"],
  },
  completed: { type: Boolean, default: false }, // Track workout completion
  completedAt: { type: Date }, // Timestamp for when the workout was completed
});

// Helper function to validate the number of sets in a station
function arrayLimit(val) {
  return val.length > 0; // Ensure at least one set
}

module.exports = mongoose.model("WorkoutLog", workoutLogSchema);
