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
router.post("/finish-workout", authMiddleWare, finishWorkOut);
router.post("/set-workout-goal", authMiddleWare, setWeeklyGoal);
router.get(
  "/completed-workouts/:userId",
  authMiddleWare,
  userCompletedWorkOuts
);

router.get("/awards", authMiddleWare, getUserAwAwards);

module.exports = router;
