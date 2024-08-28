const moment = require("moment");
const User = require("../models/user");

//================= helpers =====================
const isNewWeek = (lastWorkoutDate) => {
  const currentDate = moment();
  const startOfCurrentWeek = currentDate.clone().startOf("week");
  const startOfLastWeek = moment(lastWorkoutDate).startOf("week");

  return startOfLastWeek.isBefore(startOfCurrentWeek);
};

const isPartOfStreak = (lastWorkoutDate) => {
  // Assuming streaks are based on consecutive weeks of workouts
  const currentDate = moment();
  const lastWorkoutMoment = moment(lastWorkoutDate);
  const diffInWeeks = currentDate.diff(lastWorkoutMoment, "weeks");
  return diffInWeeks === 1; // True if the last workout was exactly a week ago
};

const getAwards = async ({ userId }) => {
  const user = await User.findOne(userId);

  const awards = {
    totalWorkoutsAwards: calculateWorkoutAwards(user.totalWorkouts),
    weeklyWorkoutAwards: calculateWeeklyAwards(user.workoutsInWeek),
    streakAwards: calculateStreakAwards(user.streaks),
  };

  return awards;
};

const calculateWorkoutAwards = (totalWorkouts) => {
  const awards = [];

  if (totalWorkouts >= 1) awards.push("1 Workout");
  if (totalWorkouts >= 5) awards.push("5 Workouts");
  if (totalWorkouts >= 10) awards.push("10 Workout");
  if (totalWorkouts >= 25) awards.push("25 Workouts");
  if (totalWorkouts >= 50) awards.push("50 Workout");
  if (totalWorkouts >= 100) awards.push("100 Workouts");
  if (totalWorkouts >= 200) awards.push("200 Workout");
  if (totalWorkouts >= 300) awards.push("300 Workouts");
  if (totalWorkouts >= 400) awards.push("400 Workout");
  if (totalWorkouts >= 500) awards.push("500 Workouts");
  return awards;
};

const calculateWeeklyAwards = (workoutsInWeek) => {
  const awards = [];

  if (workoutsInWeek >= 2) awards.push("2 Workouts in a Week");
  if (workoutsInWeek >= 3) awards.push("3 Workouts in a Week");
  if (workoutsInWeek >= 4) awards.push("4 Workouts in a Week");
  if (workoutsInWeek >= 5) awards.push("5 Workouts in a Week");
  if (workoutsInWeek >= 6) awards.push("6 Workouts in a Week");

  return awards;
};

const calculateStreakAwards = (streaks) => {
  const awards = [];

  if (streaks >= 3) awards.push("3 Week Streak");
  if (streaks >= 6) awards.push("6 Week Streak");
  if (streaks >= 12) awards.push("12 Week Streak");

  return awards;
};
module.exports = {
  isNewWeek,
  isPartOfStreak,
  getAwards,
};
