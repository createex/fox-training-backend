const express = require("express");
const router = express.Router();
const {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
  addExercise,
  getAllExercise,
  updateExercise,
  deleteExercise,
} = require("../controllers/dashboard");

router.get("/top-win-users", topWinUsers);
router.get("/user-workout-goal", userWeeklyWorkoutGoal);
router.get("/all-users", getAllUsers);
//get recent acheivements of each user
router.get("/recent-acheivements", userRecentAcheivement);

router.post("/add-exercise", addExercise);
router.get("/all-exercise", getAllExercise);

//update exercise
router.patch("/update-exercise/:exerciseId", updateExercise);
//delete exercise
router.delete("/delete-exercise/:exerciseId", deleteExercise);

module.exports = router;
