const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
    previous: { type: Number, required: true },
    lbs: { type: Number, required: true },
    reps: { type: Number, required: true },
});

const stationSchema = new mongoose.Schema({
    exerciseName: { type: String, required: true },
    sets: [setSchema],
});

const workoutSchema = new mongoose.Schema({
    image: { type: String, required: true },
    name: { type: String, required: true },
    numberOfStations: { type: Number, required: true },
    stations: [stationSchema],
});

const weekSchema = new mongoose.Schema({
    weekNumber: { type: Number, required: true },
    workouts: [workoutSchema],
});

const programSchema = new mongoose.Schema({
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    weeks: [weekSchema],
});

module.exports = mongoose.model('Program', programSchema);