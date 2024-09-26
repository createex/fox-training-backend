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

    // Default level to "Beginner"
    const level = "Beginner";

    // Find the workout by ID
    const fetchedWorkout = await findWorkOutById(workOutId, res);
    if (!fetchedWorkout) {
      return res.status(500).json({ msg: "Workout not found" });
    }

    console.log(fetchedWorkout); // Debugging line to check the workout structure

    const fetchedMeasurementType =
      fetchedWorkout.workout.stations[0].exercises[0].sets[0].measurementType;

    // Filter the workout's stations and their exercises by the specified level
    const filteredStations = fetchedWorkout.workout.stations
      .map((station) => ({
        stationNumber: station.stationNumber,
        exercises: station.exercises
          .filter((exercise) =>
            exercise.sets.some(
              (set) => set.level.toLowerCase() === level.toLowerCase()
            )
          )
          .map((exercise) => ({
            exerciseName: exercise.exerciseName,
            sets: exercise.sets
              .filter((set) => set.level.toLowerCase() === level.toLowerCase())
              .map((set) => {
                const responseSet = {
                  measurementType: set.measurementType,
                  previous: set.previous || 0, // Use previous from the set
                  lbs: set.lbs || 0, // Use lbs from the set
                  level: set.level, // Include the level from the set
                  _id: set._id,
                };

                // Include only the relevant value based on measurement type
                if (set.measurementType === "Reps") {
                  responseSet.reps = set.value;
                } else if (set.measurementType === "Time") {
                  responseSet.time = set.value;
                } else if (set.measurementType === "Distance") {
                  responseSet.distance = set.value;
                }

                return responseSet;
              })
              .filter((set) => set !== null), // Filter out any null sets
          }))
          .filter((exercise) => exercise.sets.length > 0), // Filter out exercises with no sets
      }))
      .filter((station) => station.exercises.length > 0); // Filter out stations with no exercises

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
      workOutId: fetchedWorkout.workout._id,
    };

    if (alreadyFinished) {
      // Get a single measurement type from the fetched workout
      const measurementType =
        alreadyFinished.stations[0].exercises[0].sets[0].measurementType;

      return res.status(200).json({
        msg: "This workout has already been finished by the user",
        workout: {
          stations: alreadyFinished.stations,
          weekNumber: alreadyFinished.weekNumber,
          programTitle: alreadyFinished.programTitle,
          programId: alreadyFinished.programId,
          completed: alreadyFinished.completed,
          measurementType,
        },
      });
    }

    res.status(200).json({
      workout: {
        ...workoutData,
        completed: false, // Indicate if workout is completed
        measurementType: fetchedMeasurementType,
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
  const { workOutId, stations } = req.body;
  const userId = req.user._id;

  try {
    // Check if the workout has already been finished by the user
    const alreadyFinished = await WorkOutLog.findOne({
      userId,
      completed: true,
      workOutId,
    });
    console.log("alllllllllllllllllllllllllllllllll", alreadyFinished);

    if (alreadyFinished) {
      return res.status(400).json({ msg: "Workout Already Finished" });
    }

    // Fetch workout by ID
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(404).json({ msg: "Workout not found" });
    }

    console.log(fetchedWorkOut);

    // Check if stations length are the same
    if (stations.length !== fetchedWorkOut.workout.stations.length) {
      return res
        .status(400)
        .json({ msg: "Number of station(s) are not the same" });
    }

    // Validate each station for required fields and sets
    for (const station of stations) {
      if (!station.stationNumber) {
        return res.status(400).json({ message: "Station number is required." });
      }

      // Validate exercises in each station
      for (const exercise of station.exercises) {
        if (!exercise.exerciseName) {
          return res
            .status(400)
            .json({ message: "Exercise name is required for each exercise." });
        }

        // Validate if sets exist
        if (!exercise.sets || exercise.sets.length === 0) {
          return res.status(400).json({
            message: `Exercise ${exercise.exerciseName} must include at least one set.`,
          });
        }

        // Check if all sets in the current exercise have the same measurementType
        const firstMeasurementType = exercise.sets[0].measurementType;
        const isValid = exercise.sets.every(
          (set) => set.measurementType === firstMeasurementType
        );
        if (!isValid) {
          return res.status(400).json({
            error: `All sets in exercise ${exercise.exerciseName} must have the same measurement type.`,
          });
        }

        // Ensure level is provided for each set
        exercise.sets.forEach((set) => {
          if (!set.level) {
            return res
              .status(400)
              .json({ message: "Level is required for each set." });
          }
        });
      }

      station.completed = true; // Mark the station as completed
    }

    // Create new workout log entry
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

    // After completing workout, incrementing totalWorkout count for the user
    const user = await User.findOne({ _id: userId });

    // Increment total workouts
    user.totalWorkouts += 1;
    console.log(user);
    console.log(isNewWeek(user.lastWorkoutDate));

    // Check if the workout is in a new week
    if (isNewWeek(user.lastWorkoutDate)) {
      user.workoutsInWeek = 1; // Reset to 1 since this is the first workout of the week
    } else {
      user.workoutsInWeek += 1; // Incrementing the weekly count
    }

    await updateUserStreak(user._id);
    user.lastWorkoutDate = new Date();

    await user.save();
    await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
    await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
    await checkAndAddStreakAchievements(user._id, user.streaks);
    // await checkAndAddPersonalBestAwards({
    //   userId: user._id,
    //   newWorkout,
    //   previousWorkouts,
    // });

    res.status(201).json({ msg: "Workout completed successfully", newWorkout });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Failed to finish workout", error: error });
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
      return res.status(400).json({ error: "Must provide all field values" });
    }

    if (stations.length !== numberOfStations) {
      return res.status(400).json({
        error: `Stations ${stations.length} is not the same as numberOfStations ${numberOfStations}`,
      });
    }

    // Validate each station for required fields and sets
    for (const station of stations) {
      if (!station.stationNumber) {
        return res.status(400).json({ message: "Station number is required." });
      }

      if (!station.exercises || station.exercises.length === 0) {
        return res
          .status(400)
          .json({ message: "Each station must have at least one exercise." });
      }

      // Validate each exercise in the station
      for (const exercise of station.exercises) {
        if (!exercise.exerciseName) {
          return res
            .status(400)
            .json({ message: "Exercise name is required for each exercise." });
        }

        if (!exercise.sets || exercise.sets.length === 0) {
          return res.status(400).json({
            message: `Exercise ${exercise.exerciseName} must include at least one set.`,
          });
        }

        const firstMeasurementType = exercise.sets[0].measurementType;
        const isValid = exercise.sets.every(
          (set) => set.measurementType === firstMeasurementType
        );
        if (!isValid) {
          return res.status(400).json({
            error: `All sets in exercise ${exercise.exerciseName} must have the same measurement type.`,
          });
        }

        // Ensure level is provided for each set
        exercise.sets.forEach((set) => {
          if (!set.level) {
            return res
              .status(400)
              .json({ message: "Level is required for each set." });
          }
        });
      }

      station.completed = true; // Mark the station as completed
    }

    // Update the workout details
    workout.numberOfStations = numberOfStations;
    workout.stations = stations;

    await workout.save();
    return res
      .status(200)
      .json({ msg: "Workout updated successfully", workout });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Unable to update workout", error });
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
