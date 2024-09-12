const Program = require("../models/program");
const { loginUser } = require("./authController");

// Add a new program with default weeks
const addProgram = async (req, res) => {
  const { title, startDate } = req.body;

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
  const { title, startDate } = req.body;

  try {
    const updatedProgram = await Program.findByIdAndUpdate(
      id,
      {
        title,
        startDate,
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

// Add a workout to a specific week in a program
const addWorkoutToWeek = async (req, res) => {
  const { programId, weekNumber, workout } = req.body;

  try {
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const week = program.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) {
      return res.status(404).json({ message: "Week not found" });
    }

    // Custom validation for workout
    if (!workout.name || !workout.image) {
      return res
        .status(400)
        .json({ message: "Workout name and image are required." });
    }

    if (workout.stations.length !== workout.numberOfStations) {
      return res.status(400).json({
        message: `The number of stations provided (${workout.stations.length}) does not match the expected number (${workout.numberOfStations}).`,
      });
    }

    // Validate each station for the required fields
    for (const station of workout.stations) {
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
    }

    // If all validations pass, push the workout into the week's workouts
    week.workouts.push(workout);
    await program.save();
    res.status(201).json({ message: "Workout added successfully", program });
  } catch (error) {
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
      throw new Error("Program not found");
    }

    let weekFound = false;
    for (const week of program.weeks) {
      const workoutIndex = week.workouts.findIndex(
        (w) => w._id.toString() === workoutId
      );
      if (workoutIndex !== -1) {
        // Directly replace the old workout with the updated workout
        if (stations.length !== numberOfStations) {
          console.log(stations.length, numberOfStations);

          return res
            .status(500)
            .json({ message: "stations number not matched" });
        }

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
      throw new Error("Workout not found");
    }
    await program.save();
    res.status(200).json({ message: "Workout updated successfully" });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Error updating workout", error });
  }
};

/*============  End of Update Workout In a Program  =============*/

// Delete a workout from a specific week
const deleteWorkoutFromWeek = async (req, res) => {
  const { programId, weekNumber, workoutIndex } = req.params;

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

    week.workouts.splice(workoutIndex, 1);
    await program.save();
    res.status(200).json({ message: "Workout deleted successfully", program });
  } catch (error) {
    res.status(500).json({ message: "Error deleting workout", error });
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

/*============  End of Get Program Workouts  =============*/

// Export all functions at once
module.exports = {
  addProgram,
  getPrograms,
  updateProgram,
  deleteProgram,
  addWorkoutToWeek,
  updateWorkoutInWeek,
  deleteWorkoutFromWeek,
  addStationToWorkout,
  updateStationInWorkout,
  deleteStationFromWorkout,
  addSetToStation,
  updateSetInStation,
  deleteSetFromStation,
  getProgramWorkouts,
};
