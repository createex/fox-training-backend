const User = require("../models/user");
const Program = require("../models/program");
const WorkOutLog = require("../models/userWorkOutLog");
const moment = require("moment");
const mongoose = require("mongoose");
const {
  isNewWeek,
  isPartOfStreak,
  getAwards,
} = require("../utils/userWorkOutLog");

/*=============================================
=                   Get Todays Workout                   =
=============================================*/
const getTodaysWorkOut = async (req, res) => {
  const startOfDay = moment().startOf("day").toDate();
  const endOfDay = moment().endOf("day").toDate();

  const program = await Program.findOne({
    "weeks.workouts.date": {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).lean();
  if (!program) {
    return res.status(404).json({ message: "No workout found for today" });
  }

  // Extract the workouts for today
  const todaysWorkouts = program.weeks.flatMap((week) =>
    week.workouts.filter((workout) =>
      moment(workout.date).isBetween(startOfDay, endOfDay, null, "[]")
    )
  );

  return res.status(200).json({
    workout: todaysWorkouts,
  });
};
/*============  End of Get Todays Workout  =============*/

/*=============================================
=                   start workout                   =
=============================================*/

//start workout
const startWorkOut = async (req, res) => {
  try {
    const { workOutId } = req.params;

    // Find the program containing the workout with the given ID
    const program = await Program.findOne({
      "weeks.workouts._id": new mongoose.Types.ObjectId(workOutId),
    }).lean(); // Use lean() for better performance

    if (!program) {
      return res.status(404).json({ msg: "Program not found" });
    }

    // Find the specific workout with the given ID
    let workout;
    for (const week of program.weeks) {
      workout = week.workouts.find((w) => w._id.toString() === workOutId);
      if (workout) break; // Exit loop if workout is found
    }

    if (!workout) {
      return res.status(404).json({ msg: "Workout not found" });
    }

    res.status(200).json({
      workout,
      programId: program._id,
      programTitle: program.title,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
};

/*============  End of start workout  =============*/

/*=============================================
=                   finsih workout                   =
=============================================*/

const finishWorkOut = async (req, res) => {
  const { programId, weekNumber, workOutId, stations } = req.body;
  const userId = req.user._id;
  try {
    await WorkOutLog.create({
      userId,
      workOutId,
      programId,
      weekNumber,
      stations,
      completed: true,
      completedAt: Date.now(),
    });
    //after completing workout incrementing totalWorkout count for the user
    const user = await User.findOne(userId);

    // Incrementing total workouts
    user.totalWorkouts += 1;

    // Checking if the workout is in a new week
    if (isNewWeek(user.lastWorkoutDate)) {
      user.workoutsInWeek = 1; // Reset to 1 since this is the first workout of the week
    } else {
      user.workoutsInWeek += 1; // Incrementing the weekly count
    }

    // Updating the last workout date
    user.lastWorkoutDate = new Date();

    // Updating streaks based on conditions
    if (isPartOfStreak(user.lastWorkoutDate)) {
      user.streaks += 1;
    } else {
      user.streaks = 1; // Reset streak if there's a gap
    }

    await user.save();
    res.status(201).json({ msg: "workOut completed successfully" });
  } catch (error) {
    console.log(error);

    res.status(500).json({ msg: "failed to finish workout", error: error });
  }
};

/*============  End of finsih workout  =============*/

/*=============================================
=                   user completed workouts                   =
=============================================*/
const userCompletedWorkOuts = async (req, res) => {
  try {
    const userId = req.user._id;
    const completedWorkOuts = await WorkOutLog.find({
      userId,
      completed: true,
    }).sort({ completedAt: 1 });

    const dates = completedWorkOuts.map((logs) =>
      moment(logs.completedAt).format("DD-MM-YYYY")
    );

    //return workouts completed by user, count them, return workout streak,dates of completion
    res.status(200).json({
      completedWorkOuts,
      count: completedWorkOuts.length,
      completionDates: dates,
    });
  } catch (error) {
    res.status(500).json({ msg: "error finding user workOuts", error });
  }
};

/*============  End of user completed workouts  =============*/

/*=============================================
=                   set weekly workout goad                   =
=============================================*/

const setWeeklyGoal = async (req, res) => {
  const { weeklyWorkOutGoal } = req.body;
  const userId = req.user._id;
  try {
    const updatedUserWorkOutGoal = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { weeklyWorkOutGoal: weeklyWorkOutGoal } },
      { new: true }
    );
    if (!updatedUserWorkOutGoal) {
      return res.status(404).json({ msg: "user record not found" });
    }
    res.status(200).json({
      msg: "Weekly workOut Goal set successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ msg: "error updating weekly goal", error });
  }
};

/*============  End of set weekly workout goad  =============*/

const getUserAwAwards = async (req, res) => {
  const userId = req.user._id;
  try {
    const awards = await getAwards({ userId });
    res.status(200).json(awards);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve awards" });
  }
};

module.exports = {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  getTodaysWorkOut,
};
