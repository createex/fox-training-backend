const express = require("express");
const router = express.Router();
const {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  getTodaysWorkOut,
  getUserTotalWorkouts,
  getWeightData,
  getCompletedWeeklyGoal,
  editCompletedWorkout,
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
  startWorkOut
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
router.get("/weight-data", authMiddleWare, updateActiveStatus, getWeightData);

module.exports = router;
