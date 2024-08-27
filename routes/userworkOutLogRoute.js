const express = require("express");
const router = express.Router();
const {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
} = require("../controllers/userworkOutLogController");

//start workout

router.post("/start-workout/:programId/:weekNumber", startWorkOut);
router.post("/finish-workout", finishWorkOut);
router.post("/set-workout-goal", setWeeklyGoal);
router.get("/completed-workouts/:userId", userCompletedWorkOuts);

module.exports = router;
