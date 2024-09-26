const mongoose = require("mongoose");

// Schema for individual sets (for different levels in each exercise)
const setSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced"],
    required: true,
  },
  value: { type: Number, required: true }, // reps, time, or distance value
  measurementType: {
    type: String,
    enum: ["Reps", "Time", "Distance"],
    required: true,
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
});

// Schema for each workout
const workoutSchema = new mongoose.Schema({
  image: {
    type: String, // Image for the workout
    required: true,
  },
  name: {
    type: String, // Name of the workout
    required: true,
  },
  numberOfStations: {
    type: Number,
    required: true,
    min: [1, "There must be at least one station."], // Ensure at least one station
  },
  stations: {
    type: [stationSchema], // Each workout has multiple stations
    required: true,
    validate: {
      validator: function (v) {
        return v.length === this.numberOfStations; // Ensure the number of stations matches
      },
      message: (props) =>
        `Number of stations provided (${props.value.length}) does not match the expected number (${this.numberOfStations})!`,
    },
  },
  date: {
    type: Date, // Date when the workout is scheduled
    required: true,
  },
  duration: {
    type: Number, // Store the duration in minutes
    min: [1, "Workout duration must be at least 1 minute."],
  },
});

// Schema for each week in the program
const weekSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    required: true,
    min: [1, "Week number cannot be less than 1."], // Ensure valid week number
    max: [4, "Week number cannot be greater than 4."], // Typically 1 to 4 weeks in a program
  },
  workouts: {
    type: [workoutSchema], // Each week contains multiple workouts
    required: false, // Can be empty initially, no workouts in the beginning
  },
});

// Main schema for the program
const programSchema = new mongoose.Schema({
  title: {
    type: String, // Program title
    required: true,
  },
  startDate: {
    type: Date, // Program start date
    required: true,
  },
  endDate: {
    type: Date, // Program end date
    required: true,
  },
  weeks: {
    type: [weekSchema], // Each program contains multiple weeks
    required: false, // Can be empty initially, no weeks in the beginning
  },
  numberOfWeeks: {
    type: Number,
    default: 4, // By default, assume a program has 4 weeks
  },
});

module.exports = mongoose.model("Program", programSchema);
