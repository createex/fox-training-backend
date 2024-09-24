const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: true,
  },
  sets: [
    {
      level: {
        type: String,
        enum: ["Beginner", "Intermediate", "Advanced"],
        required: true,
      },
      value: {
        type: Number,
        required: true,
      }, // reps, time, or distance value
      measurementType: {
        type: String,
        enum: ["Reps", "Time", "Distance"],
        required: true,
      },
    },
  ],
});

const Exercise = mongoose.model("Exercise", exerciseSchema);

module.exports = Exercise;
