const User = require("../models/user");
const Program = require("../models/program");
const WorkOutLog = require("../models/userWorkOutLog");
const moment = require("moment");
const {
  isNewWeek,
  isPartOfStreak,
  getAwards,
} = require("../utils/userWorkOutLog");

/*=============================================
=                   start workout                   =
=============================================*/

//start workout
const startWorkOut = async (req, res) => {
  try {
    const { workOutId } = req.params;

    // Query using the dot notation to access nested arrays properly
    const currentProgram = await Program.findOne(
      {
        "weeks.workouts._id": workOutId,
      },
      {
        "weeks.$": 1,
      }
    );

    if (!currentProgram) {
      return res.status(404).json({ msg: "Program not found" });
    }

    res.status(200).json(currentProgram);
  } catch (error) {
    res.status(500).json({ msg: "program not found" });
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
};
