const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: true,
  },
});

const Exercise = mongoose.model("Exercise", exerciseSchema);

module.exports = Exercise;
