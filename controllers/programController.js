const { BlobServiceClient } = require("@azure/storage-blob");
const Program = require("../models/program");
const { loginUser } = require("./authController");
const multer = require("multer");
const path = require("path");
const moment = require("moment");
require("dotenv").config();
const { findWorkOutById } = require("../utils/userWorkOutLog");
const ExercisesNames = require("../models/exerciesNames");

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);

// Multer setup to store files in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images are allowed"));
  },
}).single("image"); // Adjust the field name as per your form

async function uploadToAzureBlob(fileBuffer, fileName) {
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(fileBuffer);
  return blockBlobClient.url;
}
// Add a new program with default weeks
const addProgram = async (req, res) => {
  const { title, startDate, endDate } = req.body;

  // Check if startDate and endDate are valid and not in the past
  const currentDate = moment().startOf("day"); // Get the start of the current day (midnight)
  const normalizedStartDate = moment(startDate).startOf("day"); // Start of the start date
  const normalizedEndDate = moment(endDate).startOf("day"); // Start of the end date

  if (normalizedStartDate.isBefore(currentDate)) {
    return res
      .status(400)
      .json({ message: "Start date cannot be in the past." });
  }

  if (normalizedEndDate.isBefore(currentDate)) {
    return res.status(400).json({ message: "End date cannot be in the past." });
  }

  // Define default weeks structure
  const defaultWeeks = [
    {
      weekNumber: 1,
      workouts: [],
    },
    {
      weekNumber: 2,
      workouts: [],
    },
    {
      weekNumber: 3,
      workouts: [],
    },
    {
      weekNumber: 4,
      workouts: [],
    },
  ];

  try {
    const newProgram = new Program({
      title,
      startDate,
      endDate,
      weeks: defaultWeeks, // Add default weeks
    });

    await newProgram.save();
    res
      .status(201)
      .json({ message: "Program added successfully", program: newProgram });
  } catch (error) {
    res.status(500).json({ message: "Error adding program", error });
  }
};

// Get all programs
const getPrograms = async (req, res) => {
  try {
    const programs = await Program.find();
    res.status(200).json(programs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching programs", error });
  }
};

// Update a program
const updateProgram = async (req, res) => {
  const { id } = req.params;
  const { title, startDate, endDate } = req.body;

  try {
    // Check if startDate and endDate are valid and not in the past
    const currentDate = moment().startOf("day"); // Get the start of the current day (midnight)
    const normalizedStartDate = moment(startDate).startOf("day"); // Start of the start date
    const normalizedEndDate = moment(endDate).startOf("day"); // Start of the end date

    if (normalizedStartDate.isBefore(currentDate)) {
      return res
        .status(400)
        .json({ message: "Start date cannot be in the past." });
    }

    if (normalizedEndDate.isBefore(currentDate)) {
      return res
        .status(400)
        .json({ message: "End date cannot be in the past." });
    }
    const updatedProgram = await Program.findByIdAndUpdate(
      id,
      {
        title,
        startDate,
        endDate,
      },
      { new: true }
    );

    if (!updatedProgram) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.status(200).json({
      message: "Program updated successfully",
      program: updatedProgram,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating program", error });
  }
};

// Delete a program
const deleteProgram = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProgram = await Program.findByIdAndDelete(id);

    if (!deletedProgram) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.status(200).json({ message: "Program deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting program", error });
  }
};

// const addWorkoutToWeek = async (req, res) => {
//   const { programId, weekNumber, workout } = req.body;

//   try {
//     const program = await Program.findById(programId);
//     if (!program) {
//       return res.status(404).json({ message: "Program not found" });
//     }

//     // Validate workout duration
//     if (!workout.duration) {
//       return res.status(400).json({ error: "Duration is required" });
//     }

//     // Convert dates using moment
//     const workoutDate = moment(workout.date).startOf("day"); // Set time to the start of the day
//     const programStartDate = moment(program.startDate).startOf("day");
//     const programEndDate = moment(program.endDate).startOf("day");

//     // Check if the workout date is within the program's start and end dates
//     if (!workoutDate.isBetween(programStartDate, programEndDate, null, "[]")) {
//       return res.status(400).json({
//         message: `Workout date must be between program start date (${program.startDate}) and end date (${program.endDate}).`,
//       });
//     }

//     const week = program.weeks.find((w) => w.weekNumber === weekNumber);
//     if (!week) {
//       return res.status(404).json({ message: "Week not found" });
//     }

//     // Check for existing workouts on the same date
//     const existingWorkout = week.workouts.find((w) =>
//       moment(w.date).startOf("day").isSame(workoutDate)
//     );
//     if (existingWorkout) {
//       return res.status(400).json({
//         message: `A workout for this date (${workoutDate.format(
//           "YYYY-MM-DD"
//         )}) has already been added.`,
//       });
//     }

//     // Custom validation for workout name and image
//     if (!workout.name || !workout.image) {
//       return res
//         .status(400)
//         .json({ message: "Workout name and image are required." });
//     }

//     // Validate stations and their counts
//     if (!workout.stations || workout.stations.length === 0) {
//       return res.status(400).json({ error: "Workout must include stations." });
//     }

//     if (workout.stations.length !== workout.numberOfStations) {
//       return res.status(400).json({
//         message: `The number of stations provided (${workout.stations.length}) does not match the expected number (${workout.numberOfStations}).`,
//       });
//     }

//     // Measurement type should be the same
//     const firstMeasurementType = workout.stations[0].sets[0].measurementType;

//     // Validate each station for required fields and sets
//     for (const station of workout.stations) {
//       if (!station.exerciseName) {
//         return res
//           .status(400)
//           .json({ message: "Exercise name is required for each station." });
//       }

//       // Validate if sets exist
//       if (!station.sets || station.sets.length === 0) {
//         return res.status(400).json({
//           message: `Station ${station.stationNumber} must include at least one set.`,
//         });
//       }

//       // Check if all sets in the current station have the same measurementType
//       const isValid = station.sets.every(
//         (set) => set.measurementType === firstMeasurementType
//       );
//       if (!isValid) {
//         return res.status(400).json({
//           error: `All sets in station ${station.stationNumber} must have the same measurement type.`,
//         });
//       }
//     }

//     // If all validations pass, push the workout into the week's workouts
//     week.workouts.push(workout);
//     await program.save();

//     //--------------------------  EXTRACTING EXERCISE NAMES FOR SEARCH OPERATION AT FRONTEND   --------------------
//     for (const station of workout.stations) {
//       const { exerciseName, sets } = station;

//       // Check if the exercise already exists in the Exercises collection
//       const existingExercise = await ExercisesNames.findOne({
//         exerciseName,
//       });

//       if (!existingExercise) {
//         // If the  exercise does not exist, insert the new one with its sets
//         const newExercise = new ExercisesNames({
//           exerciseName,
//           sets: sets, // Add the sets related to the exercise
//         });

//         await newExercise.save();
//         console.log(`Exercise '${exerciseName}' added successfully.`);
//       } else {
//         console.log(
//           `Exercise '${exerciseName}' already exists. Skipping insertion.`
//         );
//       }
//     }
//     //================================================================================================================

//     res.status(201).json({ message: "Workout added successfully", program });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Error adding workout", error });
//   }
// };

const addWorkoutToWeek = async (req, res) => {
  const { programId, weekNumber, workout } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Validate workout duration
    if (!workout.duration) {
      return res.status(400).json({ error: "Duration is required" });
    }

    // Convert dates using moment
    const workoutDate = moment(workout.date).startOf("day"); // Set time to the start of the day
    const programStartDate = moment(program.startDate).startOf("day");
    const programEndDate = moment(program.endDate).startOf("day");

    // Check if the workout date is within the program's start and end dates
    if (!workoutDate.isBetween(programStartDate, programEndDate, null, "[]")) {
      return res.status(400).json({
        message: `Workout date must be between program start date (${program.startDate}) and end date (${program.endDate}).`,
      });
    }

    const week = program.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) {
      return res.status(404).json({ message: "Week not found" });
    }

    // Check for existing workouts on the same date
    const existingWorkout = week.workouts.find((w) =>
      moment(w.date).startOf("day").isSame(workoutDate)
    );
    if (existingWorkout) {
      return res.status(400).json({
        message: `A workout for this date (${workoutDate.format(
          "YYYY-MM-DD"
        )}) has already been added.`,
      });
    }

    // Custom validation for workout name and image
    if (!workout.name || !workout.image) {
      return res
        .status(400)
        .json({ message: "Workout name and image are required." });
    }

    // Validate stations and their counts
    if (!workout.stations || workout.stations.length === 0) {
      return res.status(400).json({ error: "Workout must include stations." });
    }

    if (workout.stations.length !== workout.numberOfStations) {
      return res.status(400).json({
        message: `The number of stations provided (${workout.stations.length}) does not match the expected number (${workout.numberOfStations}).`,
      });
    }

    // Measurement type should be the same
    const firstMeasurementType =
      workout.stations[0].exercises[0].sets[0].measurementType; // Using optional chaining

    // Validate each station for required fields and sets
    for (const station of workout.stations) {
      if (!station.stationNumber) {
        return res
          .status(400)
          .json({ message: "Station number is required for each station." });
      }

      if (!station.exercises || station.exercises.length === 0) {
        return res.status(400).json({
          message: `Station ${station.stationNumber} must include at least one exercise.`,
        });
      }

      // Validate each exercise in the station
      for (const exercise of station.exercises) {
        if (!exercise.exerciseName) {
          return res
            .status(400)
            .json({ message: "Exercise name is required for each exercise." });
        }

        // Validate if sets exist for each exercise
        if (!exercise.sets || exercise.sets.length === 0) {
          return res.status(400).json({
            message: `Exercise '${exercise.exerciseName}' in station ${station.stationNumber} must include at least one set.`,
          });
        }

        // Check if all sets in the current exercise have the same measurementType
        const isValid = exercise.sets.every(
          (set) => set.measurementType === firstMeasurementType
        );
        if (!isValid) {
          return res.status(400).json({
            error: `All sets in exercise '${exercise.exerciseName}' must have the same measurement type.`,
          });
        }
      }
    }

    // If all validations pass, push the workout into the week's workouts
    week.workouts.push(workout);
    await program.save();

    //--------------------------  EXTRACTING EXERCISE NAMES FOR SEARCH OPERATION AT FRONTEND   --------------------
    for (const station of workout.stations) {
      for (const exercise of station.exercises) {
        const { exerciseName, sets } = exercise;

        // Check if the exercise already exists in the Exercises collection
        const existingExercise = await ExercisesNames.findOne({ exerciseName });

        if (!existingExercise) {
          // If the exercise does not exist, insert the new one with its sets
          const newExercise = new ExercisesNames({
            exerciseName,
            sets: sets, // Add the sets related to the exercise
          });

          await newExercise.save();
          console.log(`Exercise '${exerciseName}' added successfully.`);
        } else {
          console.log(
            `Exercise '${exerciseName}' already exists. Skipping insertion.`
          );
        }
      }
    }
    //================================================================================================================

    res.status(201).json({ message: "Workout added successfully", program });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error adding workout", error });
  }
};
/*=============================================
=                   Update Workout In a Program                   =
=============================================*/

// Update a workout in a specific week
const updateWorkoutInWeek = async (req, res) => {
  const { programId, workoutId } = req.params;
  const { image, name, numberOfStations, stations, date } = req.body;

  try {
    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const workoutDate = moment(date).startOf("day");
    const programStartDate = moment(program.startDate).startOf("day");
    const programEndDate = moment(program.endDate).startOf("day");

    // Check if workout date is within program start and end dates
    if (!workoutDate.isBetween(programStartDate, programEndDate, null, "[]")) {
      return res.status(400).json({
        message: `Workout date must be between program start date (${program.startDate}) and end date (${program.endDate}).`,
      });
    }

    let weekFound = false;
    // Check if all sets in the current station have the same measurementType
    const firstMeasurementType =
      stations[0].exercises[0].sets[0].measurementType;

    for (const week of program.weeks) {
      const workoutIndex = week.workouts.findIndex(
        (w) => w._id.toString() === workoutId
      );

      if (workoutIndex !== -1) {
        // Check if the number of stations matches
        if (stations.length !== numberOfStations) {
          return res
            .status(400)
            .json({ message: "Number of stations does not match." });
        }

        // Validate each station for required fields and measurement type
        for (const station of stations) {
          if (!station.stationNumber) {
            return res
              .status(400)
              .json({ message: "Station number is required." });
          }

          if (!station.exercises || station.exercises.length === 0) {
            return res.status(400).json({
              message: `Station ${station.stationNumber} must include at least one exercise.`,
            });
          }

          for (const exercise of station.exercises) {
            if (!exercise.exerciseName) {
              return res.status(400).json({
                message: "Exercise name is required for each exercise.",
              });
            }

            if (!exercise.sets || exercise.sets.length === 0) {
              return res.status(400).json({
                message: `Exercise ${exercise.exerciseName} in station ${station.stationNumber} must include at least one set.`,
              });
            }

            const isValid = exercise.sets.every(
              (set) => set.measurementType === firstMeasurementType
            );

            if (!isValid) {
              return res.status(400).json({
                error: `All sets in exercise ${exercise.exerciseName} of station ${station.stationNumber} must have the same measurement type.`,
              });
            }
          }
        }

        // Directly replace the old workout with the updated workout
        week.workouts[workoutIndex].image = image;
        week.workouts[workoutIndex].name = name;
        week.workouts[workoutIndex].numberOfStations = numberOfStations;
        week.workouts[workoutIndex].stations = stations;
        week.workouts[workoutIndex].date = date;

        weekFound = true;
        break;
      }
    }

    if (!weekFound) {
      return res
        .status(404)
        .json({ message: "Workout not found in any week." });
    }

    await program.save();
    return res.status(200).json({ message: "Workout updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error updating workout", error });
  }
};

/*============  End of Update Workout In a Program  =============*/

// Delete a workout from a specific week
const deleteWorkoutFromWeek = async (req, res) => {
  const { programId, workoutId } = req.params;

  try {
    // Find the program by its ID
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    let workoutDeleted = false;

    // Iterate over each week in the program
    for (const week of program.weeks) {
      // Find the index of the workout by its ID
      const workoutIndex = week.workouts.findIndex(
        (w) => w._id.toString() === workoutId
      );

      // If the workout is found, remove it from the array
      if (workoutIndex !== -1) {
        week.workouts.splice(workoutIndex, 1); // Remove the workout
        workoutDeleted = true;
        break; // Stop searching once the workout is found and deleted
      }
    }

    if (!workoutDeleted) {
      return res.status(404).json({ message: "Workout not found" });
    }

    // Save the updated program
    await program.save();

    // Send response after successful deletion
    return res.status(200).json({ message: "Workout deleted successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error deleting workout", error });
  }
};

// Add a station to a workout
const addStationToWorkout = async (req, res) => {
  const { programId, weekNumber, workoutIndex, station } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (!week || !week.workouts[workoutIndex]) {
      return res.status(404).json({ message: "Workout not found" });
    }

    week.workouts[workoutIndex].stations.push(station);
    await program.save();
    res.status(201).json({ message: "Station added successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error adding station", error });
  }
};

// Update a station in a workout
const updateStationInWorkout = async (req, res) => {
  const { programId, weekNumber, workoutIndex, stationIndex } = req.params;
  const { station } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (
      !week ||
      !week.workouts[workoutIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex]
    ) {
      return res.status(404).json({ message: "Station not found" });
    }

    week.workouts[workoutIndex].stations[stationIndex] = station;
    await program.save();
    res.status(200).json({ message: "Station updated successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error updating station", error });
  }
};

// Delete a station from a workout
const deleteStationFromWorkout = async (req, res) => {
  const { programId, weekNumber, workoutIndex, stationIndex } = req.params;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (
      !week ||
      !week.workouts[workoutIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex]
    ) {
      return res.status(404).json({ message: "Station not found" });
    }

    week.workouts[workoutIndex].stations.splice(stationIndex, 1);
    await program.save();
    res.status(200).json({ message: "Station deleted successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error deleting station", error });
  }
};

// Add a set to a station
const addSetToStation = async (req, res) => {
  const { programId, weekNumber, workoutIndex, stationIndex, set } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (
      !week ||
      !week.workouts[workoutIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex]
    ) {
      return res.status(404).json({ message: "Station not found" });
    }

    week.workouts[workoutIndex].stations[stationIndex].sets.push(set);
    await program.save();
    res.status(201).json({ message: "Set added successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error adding set", error });
  }
};

// Update a set in a station
const updateSetInStation = async (req, res) => {
  const { programId, weekNumber, workoutIndex, stationIndex, setIndex } =
    req.params;
  const { set } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (
      !week ||
      !week.workouts[workoutIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex].sets[setIndex]
    ) {
      return res.status(404).json({ message: "Set not found" });
    }

    week.workouts[workoutIndex].stations[stationIndex].sets[setIndex] = set;
    await program.save();
    res.status(200).json({ message: "Set updated successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error updating set", error });
  }
};

// Delete a set from a station
const deleteSetFromStation = async (req, res) => {
  const { programId, weekNumber, workoutIndex, stationIndex, setIndex } =
    req.params;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find(
      (w) => w.weekNumber === parseInt(weekNumber)
    );
    if (
      !week ||
      !week.workouts[workoutIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex] ||
      !week.workouts[workoutIndex].stations[stationIndex].sets[setIndex]
    ) {
      return res.status(404).json({ message: "Set not found" });
    }

    week.workouts[workoutIndex].stations[stationIndex].sets.splice(setIndex, 1);
    await program.save();
    res.status(200).json({ message: "Set deleted successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error deleting set", error });
  }
};

/*=============================================
=                   Get Program Workouts                   =
=============================================*/

const getProgramWorkouts = async (req, res) => {
  try {
    const programId = req.params.programId;
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }
    // Extract workouts from each week
    const workouts = program.weeks.flatMap((week) => week.workouts);
    res.status(200).json({ programId: programId, workouts });
  } catch (error) {
    res.status(500).json({ message: "Unaable to fetch workouts", error });
  }
};

//add image
const addWorkoutImage = async (req, res) => {
  try {
    let imageUrl = null;
    if (req.file) {
      const fileName = `${Date.now()}${path.extname(req.file.originalname)}`;
      imageUrl = await uploadToAzureBlob(req.file.buffer, fileName);
    }

    // Respond with the image URL or an appropriate message if no file was uploaded
    if (imageUrl) {
      res.status(200).json({ imageUrl });
    } else {
      res.status(400).json({ message: "No image file provided" });
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Error uploading image", error });
  }
};

/* =====================================
=               Get Workout By Id                =
===================================== */

const getWrokoutById = async (req, res) => {
  try {
    const { workoutId } = req.params;
    const fetchedWorkout = await findWorkOutById(workoutId);
    res.status(200).json(fetchedWorkout);
  } catch (error) {
    res.status(500).json({ message: "Error Getting workout" });
  }
};

/* ========= End of Get Workout By Id ========= */

// Export all functions at once
module.exports = {
  addProgram,
  getPrograms,
  updateProgram,
  deleteProgram,
  addWorkoutToWeek,
  addWorkoutImage: [upload, addWorkoutImage],
  updateWorkoutInWeek,
  deleteWorkoutFromWeek,
  addStationToWorkout,
  updateStationInWorkout,
  deleteStationFromWorkout,
  addSetToStation,
  updateSetInStation,
  deleteSetFromStation,
  getProgramWorkouts,
  getWrokoutById,
};
