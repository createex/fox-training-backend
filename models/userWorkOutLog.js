const mongoose = require("mongoose");

// Helper function to validate the number of sets in a station
function arrayLimit(val) {
  return val.length > 0; // Ensure at least one set
}
// Schema for individual sets
const setSchema = new mongoose.Schema({
  measurementType: {
    type: String,
    enum: ["Reps", "Time", "Disstance"], // Define valid measurement types
    required: true,
  },
  previous: {
    type: Number,
    min: [0, "Previous value cannot be negative"], // Ensure non-negative
    required: function () {
      return (
        this.measurementType === "Reps" ||
        this.measurementType === "Distance" ||
        this.measurementType === "Time"
      );
    },
  },
  lbs: {
    type: Number,
    min: [0, "Weight cannot be negative"], // Ensure non-negative
    required: function () {
      return (
        this.measurementType === "Reps" ||
        this.measurementType === "Distance" ||
        this.measurementType === "Time"
      );
    },
  },
  reps: {
    type: Number,
    min: [1, "Reps must be at least 1"], // Ensure positive number
    required: function () {
      return this.measurementType === "Reps";
    },
  },
  time: {
    type: Number,
    required: function () {
      return this.measurementType === "Time";
    }, // Only required for time-based exercises
    min: [1, "Time must be at least 1 second"],
  },
  distance: {
    type: Number,
    required: function () {
      return this.measurementType === "Distance";
    }, // Only required for distance-based exercises
    min: [1, "Distance must be at least 1 meter"],
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
  stationNumber: {
    type: Number,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false, // Field to track station completion
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
  },
  numberOfStations: {
    type: Number,
    required: true,
    min: [1, "There must be at least one station"],
  },
  level: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced"], // Track the workout difficulty level
    required: true,
  },
  completed: { type: Boolean, default: false }, // Track workout completion
  completedAt: { type: Date }, // Timestamp for when the workout was completed
});

module.exports = mongoose.model("WorkoutLog", workoutLogSchema);
