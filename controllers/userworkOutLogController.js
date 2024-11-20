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
=                   Get Todays Workout        =
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
//Replacement of startWorkout API
const getWorkoutData = async (req, res) => {
  try {
    const userId = req.user._id;
    const { workOutId } = req.params;
    console.log('Processing workout data for user:', userId, 'and workout ID:', workOutId);

    // Helper function to process exercises
    const formatExercises = (exercises) => {
      return exercises.map((exercise) => {
        console.log(`Processing exercise: ${exercise.exerciseName}`);

        const levels = [...new Set(exercise.sets.map((set) => `${set.level} (${set.exerciseName || ""})`))];
        exercise.selectedLevel ||= levels[0] || "";

        const levelPattern = /Level \d+/;
        const selectedLevelMain = exercise.selectedLevel.match(levelPattern)?.[0];
        const filteredSets = exercise.sets.filter((set) => set.level === selectedLevelMain);

        return {
          exerciseName: exercise.exerciseName,
          level: exercise.selectedLevel,
          levels,
          levelsLength: levels.length,
          sets: exercise.sets.map((set) => ({
            exerciseName: set.exerciseName,
            measurementType: set.measurementType,
            previous: set.previous || 0,
            lbs: set.lbs || 0,
            level: `${set.level}`,
            reps: set.value || 0,
          })),
        };
      });
    };

    // Helper function to process stations
    const formatStations = (stations, isCompleted) => {
      return stations.map((station) => ({
        stationNumber: station.stationNumber,
        completed: isCompleted,
        exercises: formatExercises(station.exercises),
      }));
    };

    // Check for existing WorkoutLog
    let workoutLog = await WorkOutLog.findOne({ userId, workOutId });
    let workoutData;
    if (workoutLog) {
      console.log('Workout found in WorkoutLog.');
      workoutData = {
        workout: {
          stations: formatStations(workoutLog.stations, true),
          weekNumber: workoutLog.weekNumber,
          programId: workoutLog.programId,
          programTitle: workoutLog.programTitle || "",
          workOutId: workoutLog.workOutId,
          completed: true,
          measurementType: workoutLog.stations[0].exercises[0].sets[0].measurementType || "Time",
        },
      };
      return res.status(200).json(workoutData);
    }
    else
    {
      console.log('Workout not found in WorkoutLog, retrieving from Program.');
      const workout = await findWorkOutById(workOutId, res);
      if (!workout?.workout) {
        return res.status(404).json({ msg: "Workout not found" });
      }
  
      const formattedStations = formatStations(workout.workout.stations, false);
      workoutData = {
        workout: {
          stations: formattedStations,
          weekNumber: workout.weekNumber,
          programId: workout.programId,
          workOutId: workout.workout._id,
          programTitle: workout.programTitle,
          completed: false,
          measurementType: workout.workout.stations[0]?.exercises[0]?.sets[0]?.measurementType || "Time",
        },
      };
      res.status(200).json(workoutData);
    }
  } catch (error) {
    console.error('Error in getWorkoutData:', error);
    res.status(500).json({ msg: "Server error", error });
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

    // Ensure fetched workout has the necessary structure (stations & exercises)
    const workoutExercises = fetchedWorkOut.workout.stations.flatMap(station => station.exercises);

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

        // Find the matching exercise in the fetched workout
        const matchedExercise = workoutExercises.find(
          (fetchedExercise) => fetchedExercise.exerciseName === exercise.exerciseName
        );

        if (matchedExercise) {
          // Assign the levels from the matched exercise in the fetched workout
          exercise.levels = matchedExercise.levels;
        } else {
          return res
            .status(400)
            .json({ message: `Exercise ${exercise.exerciseName} not found in the fetched workout.` });
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
          if (set.measurementType === "Time") {
            set.time = set.reps;
          } else if (set.measurementType === "Distance") {
            set.distance = set.reps;
          }
          set.value = set.reps;
        });
      }

      station.completed = true; // Mark the station as completed
    }

    // Create new workout log entry
    const newWorkout = await WorkOutLog.create({
      userId,
      workOutId,
      programId: fetchedWorkOut.programId,
      programTitle: fetchedWorkOut.programTitle || "",
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

        exercise.sets.forEach((set) => {
          if (!set.level) {
            return res
              .status(400)
              .json({ message: "Level is required for each set." });
          }
          if (set.measurementType === "Time") {
            set.time = set.reps;
          } else if (set.measurementType === "Distance") {
            set.distance = set.reps;
          }
          set.value = set.reps;
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

// const searchExercise = async (req, res) => {
//   try {
//     const { exerciseName, timeframe } = req.query;
//     const userId = req.user._id;

//     if (!exerciseName) {
//       return res.status(400).json({ error: "Please provide an exercise name" });
//     }

//     let daysLength = 0;

//     if (timeframe === "1_months") {
//       daysLength = 30;
//     } else if (timeframe === "3_months") {
//       daysLength = 90;
//     } else if (timeframe === "6_months") {
//       daysLength = 180;
//     } else if (timeframe === "12_months") {
//       daysLength = 365;
//     }

//     if (daysLength === 0) {
//       return res.status(400).json({ error: "Please provide a valid time frame" });
//     }

//     const workoutLogsArray = await WorkOutLog.find({
//       userId,
//       stations: {
//         $elemMatch: {
//           exercises: {
//             $elemMatch: {
//               exerciseName: { $regex: exerciseName, $options: "i" },
//               "sets.measurementType": { $ne: null },
//             },
//           },
//         },
//       },
//     }).select("completedAt stations");

//     const resultList = workoutLogsArray.map((workoutLog) => {
//       const exercises = [];

//       workoutLog.stations.forEach((station) => {
//         station.exercises.forEach((exercise) => {
//           if (exercise.exerciseName.match(new RegExp(exerciseName, "i"))) {
//             exercise.sets.forEach((set) => {
//               if (set.measurementType !== null) {
//                 exercises.push({
//                   exerciseName: exercise.exerciseName,
//                   reps: set.reps,
//                   lbs: set.lbs,
//                 });
//               }
//             });
//           }
//         });
//       });

//       return {
//         completedAt: workoutLog.completedAt,
//         exercise: exercises[0],
//       };
//     });

//     const now = new Date();
//     const lastDays = [];

//     for (let i = 0; i < daysLength; i++) {
//       const date = new Date();
//       date.setDate(now.getDate() - i);
//       lastDays.push(date.toISOString().split("T")[0]);
//     }

//     const dailyResults = lastDays.map((day) => {
//       const workoutForDay = resultList.find((workout) => {
//         const workoutDate = new Date(workout.completedAt)
//           .toISOString()
//           .split("T")[0];
//         return workoutDate === day;
//       });

//       if (!workoutForDay) {
//         return {
//           completedAt: `${day}`,
//           exercise: {
//             exerciseName: exerciseName,
//             reps: 0,
//             lbs: 0,
//           },
//         };
//       }

//       return workoutForDay;
//     });

//     dailyResults.sort(
//       (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
//     );

//     let repsFinal = [];
//     let lbsFinal = [];
//     let dateFinal = [];

//     for (const element of dailyResults) {
//       dateFinal.push(new Date(element.completedAt).toISOString().split("T")[0]);
//       lbsFinal.push(element.exercise.lbs !== null ? element.exercise.lbs : 0);
//       repsFinal.push(element.exercise.reps !== null ? element.exercise.reps : 0);
//     }

//     return res.status(200).json({
//       data: {
//         reps: repsFinal,
//         lbs: lbsFinal,
//         date: dateFinal,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

const searchExercise = async (req, res) => {
  try {
    const { exerciseName, timeframe, range } = req.query;
    const userId = req.user._id;

    if (!exerciseName) {
      return res.status(400).json({ error: "Please provide an exercise name" });
    }

    let daysLength = 0;

    if (timeframe === "1_months") {
      daysLength = 30;
    } else if (timeframe === "3_months") {
      daysLength = 90;
    } else if (timeframe === "6_months") {
      daysLength = 180;
    } else if (timeframe === "12_months") {
      daysLength = 365;
    }

    if (daysLength === 0) {
      return res
        .status(400)
        .json({ error: "Please provide a valid time frame" });
    }

    let ranges = [];

    if (range === "4-6") {
      ranges = [4, 5, 6];
    } else if (range === "6-8") {
      ranges = [6, 7, 8];
    } else if (range === "8-10") {
      ranges = [8, 9, 10];
    } else if (range === "10-12") {
      ranges = [10, 11, 12];
    } else if (range === "12-15") {
      ranges = [12, 13, 14, 15];
    } else if (range === "15-all") {
      ranges = [15, 16, 17, 18, 19, 20];
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
                let repsVal = set.reps ?? 0;
                let lbsVal = set.lbs ?? 0;

                if (ranges.length !== 0) {
                  if (range === "15-all") {
                    if (repsVal < 15) {
                      repsVal = 0;
                    }
                  } else {
                    if (!ranges.includes(repsVal)) {
                      repsVal = 0;
                    }
                  }
                }

                if (ranges.length !== 0) {
                  if (range === "15-all") {
                    if (lbsVal < 15) {
                      lbsVal = 0;
                    }
                  } else {
                    if (!ranges.includes(lbsVal)) {
                      lbsVal = 0;
                    }
                  }
                }

                exercises.push({
                  exerciseName: exercise.exerciseName,
                  reps: repsVal,
                  lbs: lbsVal,
                });
              }
            });
          }
        });
      });

      return {
        completedAt: workoutLog.completedAt,
        exercise: exercises[0] || { exerciseName, reps: 0, lbs: 0 },
      };
    });

    const now = new Date();
    const lastDays = Array.from({ length: daysLength }, (_, i) => {
      const date = new Date();
      date.setDate(now.getDate() - i);
      return date.toISOString().split("T")[0];
    });

    const dailyResults = lastDays.map((day) => {
      const workoutForDay = resultList.find((workout) => {
        const workoutDate = new Date(workout.completedAt)
          .toISOString()
          .split("T")[0];
        return workoutDate === day;
      });

      return (
        workoutForDay || {
          completedAt: day,
          exercise: { exerciseName, reps: 0, lbs: 0 },
        }
      );
    });

    dailyResults.sort(
      (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
    );

    const repsFinal = dailyResults.map((item) => item.exercise.reps ?? 0);
    const lbsFinal = dailyResults.map((item) => item.exercise.lbs ?? 0);
    const dateFinal = dailyResults.map(
      (item) => new Date(item.completedAt).toISOString().split("T")[0]
    );

    return res.status(200).json({
      measurementType: "Reps", // Setting the measurementType as a separate field
      reps: repsFinal,
      lbs: lbsFinal,
      dates: dateFinal,
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

    // Update the selectedLevelName with the value of 'level' from query
    exercise.selectedLevel = level;
    exercise.selectedLevelName = exerciseName;
    // Save the updated exercise in the database
    await program.save();

    // Filter sets for the specific level
    const filteredSets = exercise.sets
      .filter((set) => set.level === level)
      .map((set) => {
        const setData = {
          exerciseName: set.exerciseName,
          level: set.level + (set.exerciseName ? ` (${set.exerciseName})` : ""), // Add exerciseName if it exists
          measurementType: set.measurementType,
          previous: set.previous || 0,
          lbs: set.lbs || 0, // Defaulting to 0 if missing
          distance: set.distance || 0, // Defaulting to 0 if missing
          time: set.time || 0, // Defaulting to 0 if missing
          reps: set.reps || 0, // Defaulting to 0 if missing
          distance: set.distance || 0, // Defaulting to 0 if missing
          _id: set._id,
        };

        // Add specific fields based on measurementType
        if (set.measurementType === "Reps") {
          setData.reps = set.value || 0;
        } else if (set.measurementType === "Time") {
          setData.time = set.value || 0;
        } else if (set.measurementType === "Distance") {
          setData.distance = set.value || 0;
        }

        return setData;
      });

    // Check if there are any sets for the specific level
    if (filteredSets.length === 0) {
      return res.status(404).json({
        error: `No sets found for exercise ${exerciseName} at level: ${level}.`,
      });
    }

    const levels = [];
    exercise.sets.forEach((set) => {
      const levelEntry = `${set.level}${set.exerciseName ? ` (${set.exerciseName})` : ""}`; // Avoid empty parentheses
      if (!levels.includes(levelEntry)) {
        levels.push(levelEntry);
      }
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

const getSpecificLevelData = async (req, res) => {
  try {
    const userId = req.user._id; // User ID from the request
    const { workoutId } = req.params; // Extract workoutId and weekNumber from params
    const { level, stationNumber, exerciseName } = req.query; // Extract query params

    console.debug("User ID:", userId);
    console.debug("Workout ID:", workoutId);
    console.debug("Query Params - Level:", level, "Station Number:", stationNumber, "Exercise Name:", exerciseName);

    // Helper function to update selectedLevel in an exercise
    const updateLevelInExercise = (exercise, level) => {
      console.debug("Updating exercise:", exercise.exerciseName);
      
      const levels = [...new Set(exercise.sets.map((set) => `${set.level} (${set.exerciseName || ""})`))];
      console.debug("Available Levels:", levels);

      const matchedLevel = exercise.sets.find(set => set.level.startsWith(level));
      if (!matchedLevel) {
        console.debug("No matched level found for:", level);
        return null;  // If the level doesn't exist, return null
      }

      // Step 6: Update selectedLevel in the exercise
      const newLevel = `${matchedLevel.level} (${matchedLevel.exerciseName || ""})`;
      exercise.selectedLevel = newLevel;

      console.debug("New Selected Level:", newLevel);

      return {
        exerciseName: exercise.exerciseName,
        level: newLevel,
        levels: levels,
        levelsLength: exercise.sets.length,
        sets: exercise.sets.filter(set => set.level === matchedLevel.level).map((set) => ({
          level: set.level,
          measurementType: set.measurementType,
          previous: set.previous,
          lbs: set.lbs,
          reps: set.reps,
          exerciseName: set.exerciseName,
        })),
      };
    };

    // Step 1: Call the findWorkOutById function to find the workout and program
    const workoutData = await findWorkOutById(workoutId, res);
    if (!workoutData) {
      return res.status(404).json({ message: "Workout not found." });
    }

    const { workout, weekNumber, programId } = workoutData;

    let exerciseUpdatedResponse = null;

    // Find the exercise in the specific workout, station, and week
    const programExercise = workout.stations.flatMap(station => 
      station.exercises.filter(exercise => 
        exercise.exerciseName === exerciseName && 
        station.stationNumber === stationNumber
      )
    ).find(exercise => exercise.exerciseName === exerciseName);

    if (programExercise) {
      console.debug("Exercise found in program. Updating level...");
      exerciseUpdatedResponse = updateLevelInExercise(programExercise, level);
      if (exerciseUpdatedResponse) {
        console.debug("Saving updated program...");
        // Assuming the program object is updated, you might need to save it here
        await Program.findByIdAndUpdate(programId, { $set: { "weeks.$[].workouts.$[].stations.$[].exercises": workout.stations } });
      }
    } else {
      console.debug("Exercise not found in program. Returning error...");
      return res.status(404).json({ message: "Exercise not found in program." });
    }

    // Step 2: Look for the exercise in the Workout collection (WorkoutLog)
    console.debug("Searching for workout log with workoutId:", workoutId);
    const workoutLog = await WorkOutLog.findOne({
      workOutId: workoutId,
    });

    if (workoutLog) {
      console.debug("Workout log found. Searching for exercise...");
      // Find the exercise in the workout log
      const workoutExercise = workoutLog.stations.flatMap(station => 
        station.exercises.filter(exercise => 
          exercise.exerciseName === exerciseName && 
          station.stationNumber === stationNumber
        )
      ).find(exercise => exercise.exerciseName === exerciseName);

      if (workoutExercise) {
        console.debug("Exercise found in workout log. Updating level...");
        const workoutUpdatedResponse = updateLevelInExercise(workoutExercise, level);
        if (workoutUpdatedResponse) {
          console.debug("Saving updated workout log...");
          await workoutLog.save();
          if (!exerciseUpdatedResponse) {
            exerciseUpdatedResponse = workoutUpdatedResponse;
          }
        }
      } else {
        console.debug("Exercise not found in workout log. Adding it...");
        // If the exercise doesn't exist in the workout log, add it
        const newWorkoutLog = new WorkOutLog({
          userId: userId,
          programId: programId,
          workOutId: workoutId,
          weekNumber: weekNumber,
          stations: workoutLog.stations.map(station => ({
            ...station,
            exercises: station.exercises.map(exercise => ({
              ...exercise,
              sets: exercise.sets.map(set => ({
                ...set,
                previous: set.previous || 0,
                lbs: set.lbs || 0,
                time: set.time || 0,
                reps: set.reps || 0,
                distance: set.distance || 0,
                exerciseName: set.exerciseName,
              })),
            })),
          })),
          numberOfStations: workoutLog.stations.length,
          completed: false,
          completedAt: new Date(),
        });

        console.debug("Saving new workout log...");
        // Save the new WorkoutLog
        await newWorkoutLog.save();
        exerciseUpdatedResponse = {
          message: "Exercise added to workout log with selectedLevel.",
          exerciseName,
          selectedLevel: level,
        };
      }
    }

    if (exerciseUpdatedResponse) {
      console.debug("Returning response:", exerciseUpdatedResponse);
      return res.json(exerciseUpdatedResponse);
    } else {
      console.debug("No matching exercise found to update.");
      return res.status(400).json({ message: "No matching exercise found to update." });
    }
  } catch (error) {
    console.error("Error updating exercise level:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ========= End of Get Exercises Names  ========= */
module.exports = {
  getCompletedWeeklyGoal,
  getTodaysWorkOut,
  getUserTotalWorkouts,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  editCompletedWorkout,
  getExercisesNames,
  searchExercise,
  getDataForSpecificLevel,
  getWorkoutData,
  getSpecificLevelData,
};
