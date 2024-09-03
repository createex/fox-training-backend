const User = require("../models/user");
const Program = require("../models/program");
const WorkOutLog = require("../models/userWorkOutLog");
const moment = require("moment");
const mongoose = require("mongoose");
const {
  findWorkOutById,
  isNewWeek,
  isPartOfStreak,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
} = require("../utils/userWorkOutLog");
const UserAcheivements = require("../models/userAcheivements");

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

    //checking if user has already finished this workout
    const alreadyFinished = await WorkOutLog.findOne({ workOutId });
    if (alreadyFinished) {
      return res
        .status(500)
        .json({ msg: "this workout has already been finished by user" });
    }
    //finding workout by id
    const fetchedWorkout = await findWorkOutById(workOutId); //used helper created in utils/userWorkoutLog.js
    res.status(200).json({
      workout: fetchedWorkout.workout,
      weekNumber: fetchedWorkout.weekNumber,
      programTitle: fetchedWorkout.programTitle,
      programId: fetchedWorkout.programId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error:", error });
  }
};

/*============  End of start workout  =============*/

/*=============================================
=                   finsih workout                   =
=============================================*/

const finishWorkOut = async (req, res) => {
  const { workOutId, stations } = req.body;
  const userId = req.user._id;
  try {
    // fetch workout by id
    const fetchedWorkOut = await findWorkOutById(workOutId, res);

    //checking if stations length are same
    if (stations.length !== fetchedWorkOut.workout.stations.length) {
      return res
        .status(500)
        .json({ msg: "Number of station(s) are not the same" });
    }

    await WorkOutLog.create({
      userId,
      workOutId,
      programId: fetchedWorkOut.programId,
      weekNumber: fetchedWorkOut.weekNumber,
      numberOfStations: fetchedWorkOut.workout.numberOfStations,
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
    // user.lastWorkoutDate = new Date();
    // console.log(fetchedWorkOut);

    user.lastWorkoutDate = fetchedWorkOut.workout.date;

    // Updating streaks based on conditions
    if (isPartOfStreak(user.lastWorkoutDate)) {
      user.streaks += 1;
      console.log("streak added");
    } else {
      user.streaks = 1; // Reset streak if there's a gap
    }

    await user.save();
    await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
    await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
    await checkAndAddStreakAchievements(user._id, user.streaks);
    await checkAndAddPersonalBestAwards(user._id, user.totalWorkouts);
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
      { $set: { weeklyWorkOutGoal: parseInt(weeklyWorkOutGoal) } },
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

/*=============================================
=                   Get User Awards                   =
=============================================*/

const getUserAwAwards = async (req, res) => {
  const userId = req.user._id;
  try {
    //aggregate acheivements based on category for specific user --->userId
    const userAwards = await UserAcheivements.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$category",
          awards: {
            $push: { acheivementType: "$acheivementType", date: "$date" },
          },
          count: {
            $sum: 1,
          },
        },
      },
    ]);
    res.status(200).json(userAwards);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Failed to retrieve awards" });
  }
};

/*============  End of Get User Awards  =============*/
module.exports = {
  getTodaysWorkOut,
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
};
