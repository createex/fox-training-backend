const express = require("express");
const router = express.Router();
const programController = require("../controllers/programController");

// Route to add a new program
router.post("/add", programController.addProgram);

// Route to get all programs
router.get("/allPrograms", programController.getPrograms);

// Route to update a program
router.put("/edit/:id", programController.updateProgram);

// Route to delete a program
router.delete("/del/:id", programController.deleteProgram);

// Route to add a workout to a specific week
router.post("/addWorkout", programController.addWorkoutToWeek);
router.post("/addWorkoutImage", programController.addWorkoutImage);
//route to get workouts of a particular program
router.get("/:programId/workouts", programController.getProgramWorkouts);
// Route to update a workout in a specific week
router.put(
  "/:programId/workout/:workoutId",
  programController.updateWorkoutInWeek
);
//get workout by id
router.get("/workout/:workoutId", programController.getWrokoutById);

// Route to delete a workout from a specific week
router.delete(
  "/:programId/workout/:workoutId",
  programController.deleteWorkoutFromWeek
);

// Route to add a station to a workout
router.post("/addStation", programController.addStationToWorkout);

// Route to update a station in a workout
router.put(
  "/programs/:programId/weeks/:weekNumber/workouts/:workoutIndex/stations/:stationIndex",
  programController.updateStationInWorkout
);

// Route to delete a station from a workout
router.delete(
  "/programs/:programId/weeks/:weekNumber/workouts/:workoutIndex/stations/:stationIndex",
  programController.deleteStationFromWorkout
);

// Route to add a set to a station
router.post("/programs/set", programController.addSetToStation);

// Route to update a set in a station
router.put(
  "/programs/:programId/weeks/:weekNumber/workouts/:workoutIndex/stations/:stationIndex/sets/:setIndex",
  programController.updateSetInStation
);

// Route to delete a set from a station
router.delete(
  "/programs/:programId/weeks/:weekNumber/workouts/:workoutIndex/stations/:stationIndex/sets/:setIndex",
  programController.deleteSetFromStation
);

module.exports = router;
