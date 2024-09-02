const express = require("express");
const router = express.Router();
const {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
} = require("../controllers/dashboard");

router.get("/top-win-users", topWinUsers);
router.get("/user-workout-goal", userWeeklyWorkoutGoal);
router.get("/all-users", getAllUsers);

module.exports = router;
