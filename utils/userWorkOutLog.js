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

const getAwards = async (userId) => {
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
  return awards;
};

const calculateWeeklyAwards = (workoutsInWeek) => {
  const awards = [];

  if (workoutsInWeek >= 2) awards.push("2 Workouts in a Week");
  if (workoutsInWeek >= 3) awards.push("3 Workouts in a Week");

  return awards;
};

const calculateStreakAwards = (streaks) => {
  const awards = [];

  if (streaks >= 3) awards.push("3 Week Streak");
  if (streaks >= 6) awards.push("6 Week Streak");
  return awards;
};
module.exports = {
  isNewWeek,
  isPartOfStreak,
  getAwards,
};
