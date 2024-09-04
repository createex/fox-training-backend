const express = require("express");
const router = express.Router();
const {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
  getActiveUsers,
} = require("../controllers/dashboard");

router.get("/top-win-users", topWinUsers);
router.get("/user-workout-goal", userWeeklyWorkoutGoal);
router.get("/all-users", getAllUsers);
//get recent acheivements of each user
router.get("/recent-acheivements", userRecentAcheivement);
router.get("/active-users", getActiveUsers);

module.exports = router;
