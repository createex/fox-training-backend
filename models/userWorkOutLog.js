const mongoose = require("mongoose");

// Helper function to validate the number of sets in a station
function arrayLimit(val) {
  return val.length > 0; // Ensure at least one set
}

// Schema for individual sets
const setSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced"],
    required: true,
  },
  measurementType: {
    type: String,
    enum: ["Reps", "Time", "Distance"],
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
    min: [0, "Reps cannot be negative"],
    required: function () {
      return this.measurementType === "Reps";
    },
  },
  time: {
    type: Number,
    min: [0, "TIme cannot be negative"],
    required: function () {
      return this.measurementType === "Time";
    },
  },
  distance: {
    type: Number,
    min: [0, "Distance cannot be negative"],
    required: function () {
      return this.measurementType === "Distance";
    },
  },
});

// Schema for each exercise within a station
const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: true,
  },
  sets: {
    type: [setSchema], // Multiple sets for different levels
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0; // Ensure at least one set per exercise
      },
      message: "Each exercise must have at least one set.",
    },
  },
});

// Schema for each station
const stationSchema = new mongoose.Schema({
  stationNumber: {
    type: Number,
    required: true, // Unique number for each station
  },
  exercises: {
    type: [exerciseSchema], // Each station can have multiple exercises
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0; // Ensure at least one exercise per station
      },
      message: "Each station must have at least one exercise.",
    },
  },
  completed: {
    type: Boolean,
    default: false, // Track station completion
  },
});

// Main schema for user workout logs
const workoutLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program",
    required: true,
  },
  workOutId: {
    type: mongoose.Schema.Types.ObjectId,

    required: true,
  },
  weekNumber: {
    type: Number,
    required: true,
    min: [1, "Week number cannot be less than 1"],
    max: [4, "Week number cannot be greater than 4."], // Ensure valid week number
  },
  stations: {
    type: [stationSchema], // Each workout log contains multiple stations
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0; // Ensure at least one station
      },
      message: "Workout log must contain at least one station.",
    },
  },
  numberOfStations: {
    type: Number,
    required: true,
    min: [1, "There must be at least one station"],
  },
  completed: {
    type: Boolean,
    default: false,
  }, // Track workout completion
  completedAt: {
    type: Date,
  }, // Timestamp for when the workout was completed
});

// Exporting the model
module.exports = mongoose.model("WorkoutLog", workoutLogSchema);
