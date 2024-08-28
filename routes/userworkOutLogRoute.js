const express = require("express");
const router = express.Router();
const {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
  getUserAwAwards,
} = require("../controllers/userworkOutLogController");
//auth middleware
const authMiddleWare = require("../middleware/auth");

//start workout

router.get("/start-workout/:workOutId", startWorkOut);
//finish workout
router.post("/finish-workout", authMiddleWare, finishWorkOut);
//set workout goal
router.post("/set-workout-goal", authMiddleWare, setWeeklyGoal);
//get user completed workouts details and completion dates
router.get("/completed-workouts", authMiddleWare, userCompletedWorkOuts);

//get user acheivements
router.get("/awards", authMiddleWare, getUserAwAwards);

module.exports = router;
