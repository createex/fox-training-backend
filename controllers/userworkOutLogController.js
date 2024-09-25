const User = require("../models/user");
const Program = require("../models/program");
const WorkOutLog = require("../models/userWorkOutLog");
const moment = require("moment");
const mongoose = require("mongoose");
const {
  findWorkOutById,
  isNewWeek,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
  fetchUserTodaysWorkout,
  fetchWeightData,
  updateUserStreak,
} = require("../utils/userWorkOutLog");
const UserAcheivements = require("../models/userAcheivements");
const ExercisesNames = require("../models/exerciesNames");

/*=============================================
=                   Get Todays Workout                   =
=============================================*/
const getTodaysWorkOut = async (req, res) => {
  try {
    const { workout, programId } = await fetchUserTodaysWorkout(res);
    // console.log(workout);

    return res.status(200).json({ workout: workout, programId: programId });
  } catch (error) {
    res.status(500).json({ msg: error.message || "unable to find workout" });
  }
};
/*============  End of Get Todays Workout  =============*/

/*=============================================
=                   start workout                   =
=============================================*/
const startWorkOut = async (req, res) => {
  try {
    const { workOutId } = req.params;
    const { level } = req.query; // Get level from query parameters

    // Ensure the level is valid
    const validLevels = ["Beginner", "Intermediate", "Advanced"];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ msg: "Invalid level specified" });
    }

    // Find the workout by ID
    const fetchedWorkout = await findWorkOutById(workOutId, res);
    if (!fetchedWorkout) {
      return res.status(500).json({ msg: "Workout not found" });
    }
    const fetchedMeasurementType =
      fetchedWorkout.workout.stations[0].sets[0].measurementType;
    // Filter the workout's stations and their sets by the requested level
    const filteredStations = fetchedWorkout.workout.stations
      .map((station) => ({
        exerciseName: station.exerciseName,
        stationNumber: station.stationNumber,
        sets: station.sets
          .filter((set) => set.level.toLowerCase() === level.toLowerCase())
          .map((set) => {
            // Return based on measurement type
            if (set.measurementType === "Reps") {
              return {
                measurementType: fetchedMeasurementType,
                previous: 0,
                reps: set.value,
                lbs: 0,
                _id: set._id,
              };
            } else if (set.measurementType === "Time") {
              return {
                measurementType: fetchedMeasurementType,
                previous: 0,
                lbs: 0,
                time: set.value,
                _id: set._id,
              };
            } else if (set.measurementType === "Distance") {
              return {
                measurementType: fetchedMeasurementType,
                previous: 0,
                lbs: 0,
                distance: set.value,
                _id: set._id,
              };
            }
            return null; // Handle unexpected measurement types
          })
          .filter((set) => set !== null),
        _id: station._id,
      }))
      .filter((station) => station.sets.length > 0); // Filter out stations with no sets

    if (filteredStations.length === 0) {
      return res.status(404).json({
        msg: `No stations found for ${level} level`,
        filteredStations,
      });
    }

    // Check if the user has already finished the workout
    const alreadyFinished = await WorkOutLog.findOne({
      workOutId,
      userId: req.user._id,
    });

    // Prepare response data structure
    const workoutData = {
      stations: filteredStations,
      weekNumber: fetchedWorkout.weekNumber,
      programTitle: fetchedWorkout.programTitle,
      programId: fetchedWorkout.programId,
    };

    if (alreadyFinished) {
      // Get a single measurement type from the fetched workout
      const measurementType =
        alreadyFinished.stations[0].sets[0].measurementType;
      console.log(JSON.stringify(alreadyFinished));

      return res.status(200).json({
        msg: "This workout has already been finished by the user",
        workout: {
          stations: alreadyFinished.stations,
          weekNumber: alreadyFinished.weekNumber,
          programTitle: alreadyFinished.programTitle,
          programId: alreadyFinished.programId,
          completed: alreadyFinished.completed,
          measurementType,
          level,
        },
      });
    }

    res.status(200).json({
      workout: {
        ...workoutData,
        completed: false, // Indicate if workout is completed
        measurementType: fetchedMeasurementType,

        // Include a single measurementType from the original workout data if available
        level,
      },
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
  const { workOutId, stations, level } = req.body;
  const userId = req.user._id;
  try {
    const previousWorkouts = await WorkOutLog.find({ userId, completed: true });
    // fetch workout by id
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(500).json({ msg: "Workout not found" });
    }
    console.log(fetchedWorkOut);

    //checking if stations length are same
    if (stations.length !== fetchedWorkOut.workout.stations.length) {
      return res
        .status(500)
        .json({ msg: "Number of station(s) are not the same" });
    }
    // Measurement type should be the same
    const firstMeasurementType = stations[0].sets[0].measurementType;

    // Validate each station for required fields and sets
    for (const station of stations) {
      if (!station.exerciseName) {
        return res
          .status(400)
          .json({ message: "Exercise name is required for each station." });
      }

      // Validate if sets exist
      if (!station.sets || station.sets.length === 0) {
        return res.status(400).json({
          message: `Station ${station.stationNumber} must include at least one set.`,
        });
      }

      // Check if all sets in the current station have the same measurementType
      const isValid = station.sets.every(
        (set) => set.measurementType === firstMeasurementType
      );
      if (!isValid) {
        return res.status(400).json({
          error: `All sets in station ${station.stationNumber} must have the same measurement type.`,
        });
      }
      station.completed = true;
    }

    const newWorkout = await WorkOutLog.create({
      userId,
      workOutId,
      programId: fetchedWorkOut.programId,
      weekNumber: fetchedWorkOut.weekNumber,
      numberOfStations: fetchedWorkOut.workout.numberOfStations,
      stations,
      level: level,
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

    await updateUserStreak(user._id);
    user.lastWorkoutDate = new Date();

    // await user.save();
    await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
    await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
    await checkAndAddStreakAchievements(user._id, user.streaks);
    // await checkAndAddPersonalBestAwards({
    //   userId: user._id,
    //   newWorkout,
    //   previousWorkouts,
    // });
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
    const programId = req.params.programId;
    // Fetch completed workouts for the user and program
    const completedWorkOuts = await WorkOutLog.find({
      userId,
      completed: true,
      programId,
    }).sort({ completedAt: 1 });

    // Map completion dates formatted as 'DD-MM-YYYY'
    const dates = completedWorkOuts.map((logs) =>
      moment(logs.completedAt).format("DD-MM-YYYY")
    );

    // Fetch the program to get start and end dates
    const program = await Program.findOne({ _id: programId });
    if (!program) {
      return res.status(200).json({
        completionDates: [],
        programDates: {
          startDate: "",
          endDate: "",
        },
      });
    }

    // Format startDate and endDate to display like 'Sep 19' without the year
    const formattedStartDate = moment(program.startDate).format("MMM D");
    const formattedEndDate = moment(program.endDate).format("MMM D");

    // Return workouts completion dates and formatted program dates
    res.status(200).json({
      completionDates: dates,
      programDates: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error finding user workouts", error });
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

/*=============================================
=                   Get Weight Data                   =
=============================================*/

const getWeightData = async (req, res) => {
  const userId = req.user._id;
  const { repRange, timePeriod } = req.query;

  try {
    const data = await fetchWeightData(repRange, timePeriod, userId);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*============  End of Get Weight Data  =============*/

/*=============================================
=                   Edit Completed Workout                   =
=============================================*/

const editCompletedWorkout = async (req, res) => {
  const userId = req.user._id;
  try {
    const workOutId = req.params.workoutId;
    const workout = await WorkOutLog.findOne({
      userId,
      workOutId,
      completed: true,
    });
    console.log(workout);

    if (!workout) {
      return res
        .status(404)
        .json({ error: "No workout completed with this Id" });
    }
    const { numberOfStations, stations } = req.body;
    if (!numberOfStations || !stations) {
      return res.status(500).json({ error: "Must provide all field values" });
    }
    if (stations.length !== numberOfStations) {
      return res.status(500).json({
        error: `Stations ${stations.length} is not the same as numberOfStations ${numberOfStations}`,
      });
    }
    const firstMeasurementType = workout.stations[0].sets[0].measurementType;
    //applying validation
    for (const station of stations) {
      if (!station.exerciseName) {
        return res
          .status(400)
          .json({ message: "Exercise name is required for each station." });
      }
      if (!station.sets || station.sets.length === 0) {
        return res
          .status(400)
          .json({ message: "Each station must have at least one set." });
      }
      const isValid = station.sets.every(
        (set) => set.measurementType === firstMeasurementType
      );
      if (!isValid) {
        return res.status(400).json({
          error: `All sets in station ${station.stationNumber} must have the same measurement type.`,
        });
      }
      station.completed = true;
    }

    workout.numberOfStations = numberOfStations;
    workout.stations = stations;
    await workout.save();
    return res
      .status(200)
      .json({ msg: "workout updated successfully", workout });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ msg: "unable to update workout" });
  }
};

/*============  End of Edit Completed Workout  =============*/

/* =====================================
=               Get Exercises Names                =
===================================== */
const getExercisesNames = async (req, res) => {
  try {
    const exercises = await ExercisesNames.find().select("exerciseName -_id"); // Get only the name field
    const exercisesNames = exercises.map((exer) => {
      return exer.exerciseName;
    });
    res.json({ exercises: exercisesNames });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch exercises" });
  }
};

const getExerciseByName = async (req, res) => {
  try {
    const { name } = req.query;
    const userId = req.user._id;

    if (!name) {
      return res.status(400).json({ error: "Please provide  exercise name" });
    }

    // Perform a search in workoutLog based on userId and exerciseName (case-insensitive)
    const workoutLogs = await WorkOutLog.find({
      userId,
      stations: {
        $elemMatch: {
          exerciseName: { $regex: name, $options: "i" }, // Case-insensitive search for exercise name
        },
      },
    }).select("stations.exerciseName completedAt stations.sets -_id"); // Return stations that contain the exercise name

    // Filter out only the stations that match the exercise name
    const results = workoutLogs.flatMap((log) =>
      log.stations
        .filter((station) =>
          station.exerciseName.toLowerCase().includes(name.toLowerCase())
        )
        .map((station) => ({
          station, // Include all station data
          completedAt: log.completedAt, // Include completion date from workoutLog
        }))
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No stations found with the given exercise name" });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Error searching stations:", error);
    res.status(500).json({ error: "Failed to search completed exercises" });
  }
};

/* ========= End of Get Exercises Names  ========= */
module.exports = {
  getCompletedWeeklyGoal,
  getTodaysWorkOut,
  startWorkOut,
  getUserTotalWorkouts,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  getWeightData,
  editCompletedWorkout,
  getExercisesNames,
  getExerciseByName,
};
