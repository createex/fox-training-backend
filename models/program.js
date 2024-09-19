const mongoose = require("mongoose");

// Schema for individual sets
const setSchema = new mongoose.Schema({
  previous: {
    type: Number,
    required: true,
  },
  lbs: {
    type: Number,
    required: true,
  },
  reps: {
    type: Number,
    required: true,
  },
});

// Schema for each station
const stationSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: false,
  },
  stationNumber: {
    type: Number,
    required: true,
  },
  sets: {
    type: [setSchema],
    required: true,
  },
});

// Schema for each workout
const workoutSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  numberOfStations: {
    type: Number,
    required: true,
    min: [1, "There must be at least one station"], // Ensure at least one station
  },
  stations: {
    type: [stationSchema],
    required: true,
    validate: {
      validator: function (v) {
        return v.length === this.numberOfStations; // Ensure number of stations match
      },
      message: (props) =>
        `Number of stations provided (${props.value.length}) does not match the expected number (${this.numberOfStations})!`,
    },
  },
  date: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // Store the duration in minutes
    min: [1, "Workout duration must be at least 1 minute"],
  },
});

// Schema for each week
const weekSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    required: true,
    min: [1, "Week number cannot be less than 1"], // Ensure valid week number
    max: [4, "Week number cannot be greater than 4"], // Ensure week number is between 1 and 4
  },
  workouts: {
    type: [workoutSchema],
    required: false, // Can be empty initially
  },
});

// Main schema for the program
const programSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  weeks: {
    type: [weekSchema],
    required: false, // Can be empty initially
  },
});

module.exports = mongoose.model("Program", programSchema);
