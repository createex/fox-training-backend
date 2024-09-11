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

  getCompletedWeeklyGoal,
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
//get user completed workouts details and completion dates
router.get(
  "/completed-dates",
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

module.exports = router;
