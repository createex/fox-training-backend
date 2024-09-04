const express = require("express");
const router = express.Router();
const {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
  getTodaysWorkOut,
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
  "/completed-workouts",
  authMiddleWare,
  updateActiveStatus,
  userCompletedWorkOuts
);

//get user acheivements
router.get("/awards", authMiddleWare, updateActiveStatus, getUserAwAwards);

module.exports = router;
