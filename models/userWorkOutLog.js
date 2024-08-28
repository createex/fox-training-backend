const mongoose = require("mongoose");
/*=============================================
=                   schema for user workout logs (History)                   =
=============================================*/

const workoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program",
    required: true,
  },
  weekNumber: { type: Number, required: true },
  workOutId: { type: mongoose.Schema.Types.ObjectId, required: true },
  stations: [
    {
      exerciseName: { type: String, required: true },
      sets: [
        {
          previous: { type: Number, required: true },
          lbs: { type: Number, required: true },
          reps: { type: Number, required: true },
        },
      ],
    },
  ],
  weeklyWorkOutGoal: {
    type: Number,
    default: 0,
  },
  completed: { type: Boolean, default: false }, // Track workout completion
  completedAt: { type: Date }, // Timestamp for when the workout was completed
});

module.exports = mongoose.model("WorkoutLog", workoutLogSchema);

/*============  End of schema for user workout logs (History)  =============*/
