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

    // Find the workout by ID
    const fetchedWorkout = await findWorkOutById(workOutId, res);
    if (!fetchedWorkout || !fetchedWorkout.workout) {
      console.error(`Workout with ID ${workOutId} not found or incomplete`);
      return res.status(404).json({ msg: "Workout not found" });
    }

    // Automatically determine the measurement type for the workout
    const fetchedMeasurementType =
      fetchedWorkout?.workout?.stations?.[0]?.exercises?.[0]?.sets?.[0]
        ?.measurementType;

    // If no measurement type, return an error early
    if (!fetchedMeasurementType) {
      console.error(`Measurement type not found for workout ${workOutId}`);
      return res
        .status(400)
        .json({ msg: "Invalid workout format or missing measurement type" });
    }

    // Format exercises for ongoing workouts
    const formatExercises = (exercises) => {
      return exercises.map((exercise) => {
        const lowestLevelSet = exercise.sets.reduce((prev, curr) => {
          if (!prev || curr.level.toLowerCase() < prev.level.toLowerCase()) {
            return curr;
          }
          return prev;
        }, null);

        // Generate unique levels without duplicates
        const levels = [];
        exercise.sets.forEach((set) => {
          if (!levels.includes(set.level)) {
            levels.push(set.level);
          }
        });

        return {
          exerciseName: exercise.exerciseName,
          level: lowestLevelSet.level,
          levels,
          levelsLength: levels.length,
          sets: exercise.sets
            .filter((set) => set.level === lowestLevelSet.level)
            .map((set) => {
              const responseSet = {
                measurementType: set.measurementType,
                previous: set.previous || 0,
                lbs: set.lbs || 0,
                level: set.level,
                _id: set._id,
              };
              // Ensure reps, time, and distance are assigned correctly
              if (set.measurementType === "Reps") {
                responseSet.reps = set.value; // Use value for reps
              } else if (set.measurementType === "Time") {
                responseSet.time = set.value; // Use value for time
              } else if (set.measurementType === "Distance") {
                responseSet.distance = set.value; // Use value for distance
              }

              return responseSet;
            }),
        };
      });
    };

    const filteredStations = fetchedWorkout.workout.stations
      .map((station) => ({
        stationNumber: station.stationNumber,
        completed: false,
        exercises: formatExercises(station.exercises),
      }))
      .filter((station) => station.exercises.length > 0); // Filter out stations with no exercises

    if (filteredStations.length === 0) {
      return res.status(404).json({
        msg: `No stations found`,
        filteredStations,
      });
    }

    // Check if the workout has been finished already
    const alreadyFinished = await WorkOutLog.findOne(
      {
        workOutId,
        userId: req.user._id,
      },
      { "stations.exercises._id": 0, "stations._id": 0 }
    );

    const workoutData = {
      stations: filteredStations,
      weekNumber: fetchedWorkout.weekNumber,
      programId: fetchedWorkout.programId,
      workOutId: fetchedWorkout.workout._id,
      programTitle: fetchedWorkout.programTitle,
    };

    if (alreadyFinished) {
      // Use a modified function to format exercises for already finished workouts
      const formatFinishedExercises = (exercises) => {
        return exercises.map((exercise) => {
          const levels = [];
          exercise.sets.forEach((set) => {
            if (!levels.includes(set.level)) {
              levels.push(set.level);
            }
          });

          return {
            exerciseName: exercise.exerciseName,
            level: exercise.sets[0].level,
            levels,
            levelsLength: exercise.sets.length, // Include all sets
            sets: exercise.sets.map((set) => {
              const responseSet = {
                measurementType: set.measurementType,
                previous: set.previous || 0,
                lbs: set.lbs || 0,
                level: set.level,
                _id: set._id,
              };

              // Ensure reps, time, and distance are assigned correctly
              // Check if set.value is defined before assigning
              if (set.measurementType === "Reps") {
                responseSet.reps = set.reps; // Use value for reps, default to 0 if undefined
              } else if (set.measurementType === "Time") {
                responseSet.time = set.time; // Use value for time, default to 0 if undefined
              } else if (set.measurementType === "Distance") {
                responseSet.distance = set.distance; // Use value for distance, default to 0 if undefined
              }

              return responseSet;
            }),
          };
        });
      };

      const alreadyFinishedStations = alreadyFinished.stations.map(
        (station) => {
          const plainStation = station.toObject();
          plainStation.exercises = formatFinishedExercises(
            plainStation.exercises
          );
          return plainStation;
        }
      );

      return res.status(200).json({
        workout: {
          stations: alreadyFinishedStations,
          weekNumber: alreadyFinished.weekNumber,
          programId: alreadyFinished.programId,
          completed: alreadyFinished.completed,
          workOutId: alreadyFinished.workOutId,
          measurementType: fetchedMeasurementType,
          programTitle: fetchedWorkout.programTitle,
        },
      });
    }

    res.status(200).json({
      workout: {
        ...workoutData,
        completed: false,
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
    const previousWorkouts = await WorkOutLog.find({ userId });

    if (alreadyFinished) {
      return res.status(400).json({ msg: "Workout Already Finished" });
    }

    // Fetch workout by ID
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(404).json({ msg: "Workout not found" });
    }

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

    res.status(201).json({ msg: "Workout completed successfully" });
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
    const dates = completedWorkOuts.map((log) =>
      moment(log.completedAt).format("DD-MM-YYYY")
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
    console.log("Error finding user workouts:", error);
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

    const { stations } = req.body;

    if (!stations) {
      return res.status(400).json({ error: "stations required" });
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
    workout.numberOfStations = stations.length;
    workout.stations = stations;

    await workout.save();
    return res.status(200).json({ msg: "Workout updated successfully" });
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

const searchExercise = async (req, res) => {
  try {
    const { exerciseName, timeframe } = req.query;
    const userId = req.user._id;

    if (!exerciseName) {
      return res.status(400).json({ error: "Please provide an exercise name" });
    }

    let daysLength = 0;

    if (timeframe == "1_months") {
      daysLength = 30;
    } else if (timeframe == "3_months") {
      daysLength = 90;
    } else if (timeframe == "6_months") {
      daysLength = 180;
    } else if (timeframe == "12_months") {
      daysLength = 365;
    }

    if (daysLength == 0) {
      return res
        .status(400)
        .json({ error: "Please provide an valid time frame" });
    }

    const workoutLogsArray = await WorkOutLog.find({
      userId,
      stations: {
        $elemMatch: {
          exercises: {
            $elemMatch: {
              exerciseName: { $regex: exerciseName, $options: "i" },
              "sets.measurementType": { $ne: null },
            },
          },
        },
      },
    }).select("completedAt stations");

    const resultList = workoutLogsArray.map((workoutLog) => {
      const exercises = [];

      workoutLog.stations.forEach((station) => {
        station.exercises.forEach((exercise) => {
          if (exercise.exerciseName.match(new RegExp(exerciseName, "i"))) {
            exercise.sets.forEach((set) => {
              if (set.measurementType !== null) {
                exercises.push({
                  exerciseName: exercise.exerciseName,
                  reps: set.reps,
                  lbs: set.lbs,
                });
              }
            });
          }
        });
      });

      return {
        completedAt: workoutLog.completedAt,
        exercise: exercises[0],
      };
    });
    const now = new Date();
    const lastDays = [];

    for (let i = 0; i < daysLength; i++) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      lastDays.push(date.toISOString().split("T")[0]);
    }

    const dailyResults = lastDays.map((day) => {
      const workoutForDay = resultList.find((workout) => {
        const workoutDate = new Date(workout.completedAt)
          .toISOString()
          .split("T")[0];
        return workoutDate === day;
      });

      if (!workoutForDay) {
        return {
          completedAt: `${day}T00:00:00.000Z`,
          exercise: {
            exerciseName: exerciseName,
            reps: 0,
            lbs: 0,
          },
        };
      }

      return workoutForDay;
    });

    dailyResults.sort(
      (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
    );

    let repsFinal = [];
    let lbsFinal = [];
    let dateFinal = [];

    for (const element of dailyResults) {
      dateFinal.push(element.completedAt);
      lbsFinal.push(element.exercise.lbs);
      repsFinal.push(element.exercise.reps);
    }

    return res.status(200).json({
      data: {
        reps: repsFinal,
        lbs: lbsFinal,
        date: dateFinal,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDataForSpecificLevel = async (req, res) => {
  try {
    const { workoutId } = req.params; // Get workoutId from params
    const { level, stationNumber, exerciseName } = req.query; // Get level, stationNumber, and exerciseName from query

    // Validate query parameters
    if (!level || !stationNumber || !workoutId || !exerciseName) {
      return res.status(400).json({
        error:
          "Workout ID, level, station number, and exercise name are required.",
      });
    }

    // Fetch the specific program that contains the workouts
    const program = await Program.findOne({ "weeks.workouts._id": workoutId })
      .populate("weeks.workouts.stations.exercises.sets") // Populate nested fields
      .exec();

    if (!program) {
      return res
        .status(404)
        .json({ error: "No program found containing the specified workout." });
    }

    // Find the workout based on the workoutId across all weeks
    let workout;
    for (const week of program.weeks) {
      workout = week.workouts.find((w) => w._id.toString() === workoutId);
      if (workout) break; // Exit loop if workout is found
    }

    if (!workout) {
      return res
        .status(404)
        .json({ error: "No workout found for the given ID." });
    }

    // Find the station in the workout data
    const station = workout.stations.find(
      (station) => station.stationNumber === parseInt(stationNumber)
    );

    if (!station) {
      return res
        .status(404)
        .json({ error: `No station found with number ${stationNumber}.` });
    }

    // Find the specific exercise by exerciseName
    const exercise = station.exercises.find(
      (exercise) => exercise.exerciseName === exerciseName
    );

    if (!exercise) {
      return res
        .status(404)
        .json({ error: `No exercise found with name: ${exerciseName}.` });
    }

    // Filter sets for the specific level
    const filteredSets = exercise.sets
      .filter((set) => set.level === level)
      .map((set) => {
        // Add common fields
        const setData = {
          level: set.level,
          measurementType: set.measurementType,
          previous: set.previous || 0, // Add previous field with default value 0
          lbs: set.lbs || 0, // Add lbs field with default value 0
          _id: set._id,
        };

        // Add specific fields based on measurementType
        if (set.measurementType === "Reps") {
          setData.reps = set.value || 0; // Add reps if measurementType is Reps
        } else if (set.measurementType === "Time") {
          setData.time = set.value || 0; // Add time if measurementType is Time
        } else if (set.measurementType === "Distance") {
          setData.distance = set.value || 0; // Add distance if measurementType is Distance
        }

        return setData;
      });

    // Check if there are any sets for the specific level
    if (filteredSets.length === 0) {
      return res.status(404).json({
        error: `No sets found for exercise ${exerciseName} at level: ${level}.`,
      });
    }
    const levels = exercise.sets.map((set) => {
      return set.level;
    });
    // Return filtered exercise data
    return res.status(200).json({
      exercise: {
        exerciseName: exercise.exerciseName,
        levels,
        levelsLength: levels.length,
        level: filteredSets[0].level,
        sets: filteredSets,
      },
    });
  } catch (error) {
    console.error("Error retrieving data for specific level:", error);
    res.status(500).json({ msg: "Cannot return data for level" });
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
  editCompletedWorkout,
  getExercisesNames,
  searchExercise,
  getDataForSpecificLevel,
};
