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
  fetchUserTodaysWorkout,
} = require("../utils/userWorkOutLog");
const UserAcheivements = require("../models/userAcheivements");

/*=============================================
=                   Get Todays Workout                   =
=============================================*/
const getTodaysWorkOut = async (req, res) => {
  try {
    const { workout, programId } = await fetchUserTodaysWorkout(res);
    // console.log(workout);

    res.status(200).json({ workout: workout, programId: programId });
  } catch (error) {
    res.status(500).json({ msg: "unable to find workout" });
  }
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
    const fetchedWorkout = await findWorkOutById(workOutId, res); //used helper created in utils/userWorkoutLog.js
    if (!fetchedWorkout) {
      return res.status(500).json({ msg: "Workout not found" });
    }
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
    const previousWorkouts = await WorkOutLog.find({ userId, completed: true });
    // fetch workout by id
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(500).json({ msg: "Workout not found" });
    }

    //checking if stations length are same
    if (stations.length !== fetchedWorkOut.workout.stations.length) {
      return res
        .status(500)
        .json({ msg: "Number of station(s) are not the same" });
    }

    const newWorkout = await WorkOutLog.create({
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

    // Updating streaks based on conditions
    if (isPartOfStreak(user.lastWorkoutDate)) {
      user.streaks += 1;
      console.log("streak added");
    } else {
      user.streaks = 1; // Reset streak if there's a gap
    }
    user.lastWorkoutDate = new Date();

    await user.save();
    await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
    await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
    await checkAndAddStreakAchievements(user._id, user.streaks);
    await checkAndAddPersonalBestAwards({
      userId: user._id,
      newWorkout,
      previousWorkouts,
    });
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

    //return workouts completed by user
    res.status(200).json({
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

const getUserTotalWorkouts = async (req, res) => {
  try {
    const userId = req.user._id;
    const programId = req.params.programId;
    console.log(programId);

    const user = await User.findOne({ _id: userId });
    const totalWorkouts = user.totalWorkouts;
    const programWorkouts = await WorkOutLog.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          programId: new mongoose.Types.ObjectId(programId),
          completed: true,
        },
      },
      {
        $count: "programWorkouts",
      },
    ]);

    const userWorkouts = {
      totalWorkouts: totalWorkouts,
      programWorkouts:
        programWorkouts.length == 0 ? 0 : programWorkouts[0].programWorkouts,
    };

    res.status(200).json(userWorkouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Failed to retrieve workouts" });
  }
};

/*============  End of Get User Awards  =============*/

/*=============================================
=                   Weekly completed Goal                   =
=============================================*/

const getCompletedWeeklyGoal = async (req, res) => {
  try {
    // Get the start and end of the current week
    const userId = req.user._id;
    const startOfWeek = moment().startOf("week").toDate();
    const endOfWeek = moment().endOf("week").toDate();
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const userWeeklyGoal = user.weeklyWorkOutGoal;
    // Query to count workouts completed this week
    const completedWorkoutsCount = await WorkOutLog.countDocuments({
      userId,
      completed: true, // Filter for completed workouts
      completedAt: { $gte: startOfWeek, $lte: endOfWeek }, // Date range for this week
    });
    const completedWorkouts = {
      userWeeklyGoal,
      completedGoal: completedWorkoutsCount,
      total: `${completedWorkoutsCount}/${userWeeklyGoal}`,
    };
    res.status(200).json(completedWorkouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Failed to retrieve weekly completed goal" });
  }
};

/*============  End of Weekly completed Goal  =============*/
module.exports = {
  getCompletedWeeklyGoal,
  getTodaysWorkOut,
  startWorkOut,
  getUserTotalWorkouts,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
};
