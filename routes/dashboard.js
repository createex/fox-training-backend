const express = require("express");
const router = express.Router();
const {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
  addExercise,
  getAllExercise,
} = require("../controllers/dashboard");

router.get("/top-win-users", topWinUsers);
router.get("/user-workout-goal", userWeeklyWorkoutGoal);
router.get("/all-users", getAllUsers);
//get recent acheivements of each user
router.get("/recent-acheivements", userRecentAcheivement);

router.post("/add-exercise", addExercise);
router.get("/all-exercise", getAllExercise);

module.exports = router;
