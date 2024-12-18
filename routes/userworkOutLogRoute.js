const express = require("express");
const router = express.Router();
const {
  startWorkOut,
  getWorkoutData,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  getTodaysWorkOut,
  getUserTotalWorkouts,
  getCompletedWeeklyGoal,
  editCompletedWorkout,
  getExercisesNames,
  searchExercise,
  getDataForSpecificLevel,
  getSpecificLevelData
} = require("../controllers/userworkOutLogController");
const updateActiveStatus = require("../middleware/updateActiveStatus");

//auth middleware
const authMiddleWare = require("../middleware/auth");

router.get(
  "/todays-workout",
  authMiddleWare,
  updateActiveStatus,
  getTodaysWorkOut
);
//start workout

router.get(
  "/start-workout/:workOutId",
  authMiddleWare,
  updateActiveStatus,
  getWorkoutData
);
//finish workout
router.post(
  "/finish-workout",
  authMiddleWare,
  updateActiveStatus,
  finishWorkOut
);
//set workout goal
router.post(
  "/set-workout-goal",
  authMiddleWare,
  updateActiveStatus,
  setWeeklyGoal
);

//edit completed workout
router.patch(
  "/edit-workout/:workoutId",
  authMiddleWare,
  updateActiveStatus,
  editCompletedWorkout
);
//get user completed workouts details and completion dates
router.get(
  "/completed-dates/:programId",
  authMiddleWare,
  updateActiveStatus,
  userCompletedWorkOuts
);

router.get(
  "/user-total-workouts/:programId",
  authMiddleWare,
  updateActiveStatus,
  getUserTotalWorkouts
);

//get user acheivements
router.get("/awards", authMiddleWare, updateActiveStatus, getUserAwAwards);

//completed workouts out of weekly workout goal
router.get(
  "/completed-goal",
  authMiddleWare,
  updateActiveStatus,
  getCompletedWeeklyGoal
);

//weight data for reps range
router.get("/exercises", authMiddleWare, updateActiveStatus, getExercisesNames);
router.get(
  "/exercises/search",
  authMiddleWare,
  updateActiveStatus,
  searchExercise
);
router.get("/exercises/level/:workoutId", authMiddleWare, getSpecificLevelData);

module.exports = router;
