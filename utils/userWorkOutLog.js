const moment = require("moment");
const User = require("../models/user");
const Acheivements = require("../models/userAcheivements");
const Program = require("../models/program");
const mongoose = require("mongoose");

// finding specific workout by id
const findWorkOutById = async (workOutId) => {
  // Find the program containing the workout with the given ID
  const program = await Program.findOne({
    "weeks.workouts._id": new mongoose.Types.ObjectId(workOutId),
  }).lean(); // Use lean() for better performance

  if (!program) {
    return res.status(404).json({ msg: "Program not found" });
  }

  // Initialize variables to hold the found workout and week number
  let workout;
  let weekNumber;

  // Find the specific workout with the given ID and the corresponding week number
  for (const week of program.weeks) {
    workout = week.workouts.find((w) => w._id.toString() === workOutId);
    if (workout) {
      weekNumber = week.weekNumber; // Store the week number
      break; // Exit loop if workout is found
    }
  }
  if (!workout) {
    return res.status(404).json({ msg: "Workout not found" });
  }

  return {
    workout,
    weekNumber,
    programTitle: program.title,
    programId: program._id,
  };
};

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

const addAchievement = async (userId, newAchievement) => {
  try {
    const userAcheivements = await Acheivements.find({ userId: userId });

    // Check if the achievement already exists with the same type and description
    const alreadyExists = userAcheivements.some(
      (achievement) =>
        achievement.acheivementType === newAchievement.acheivementType &&
        achievement.category === newAchievement.category
    );

    // If not already exists, add new achievement with the current date
    if (!alreadyExists) {
      const newAchievementDocument = new Acheivements({
        userId: userId,
        ...newAchievement,
        date: new Date(),
      });
      await newAchievementDocument.save();
    } else {
      console.log("Achievement already exists for today");
    }
  } catch (error) {
    console.error("Error adding achievement:", error);
  }
};
const checkAndAddWorkoutAchievements = async (userId, workoutsCompleted) => {
  if (workoutsCompleted === 1) {
    await addAchievement(userId, {
      acheivementType: "1 Workout",
      category: "total_workouts",
    });
  }
  if (workoutsCompleted === 5) {
    await addAchievement(userId, {
      acheivementType: "5 Workout",
      category: "total_workouts",
    });
  }
};
const checkAndAddWeeklyAchievements = async (userId, workoutsInWeek) => {
  console.log(workoutsInWeek);

  if (workoutsInWeek === 2) {
    await addAchievement(userId, {
      acheivementType: "2 Workout",
      category: "workouts_in_week",
    });
  }
  if (workoutsInWeek === 3) {
    await addAchievement(userId, {
      acheivementType: "3 Workout",
      category: "workouts_in_week",
    });
  }
};
const checkAndAddStreakAchievements = async (userId, streaks) => {
  if (streaks === 3) {
    await addAchievement(userId, {
      acheivementType: "3 weeks",
      category: "streaks",
    });
  }
  if (streaks === 6) {
    await addAchievement(userId, {
      acheivementType: "6 weeks",
      category: "streaks",
    });
  }
  if (streaks === 12) {
    await addAchievement(userId, {
      acheivementType: "12 weeks",
      category: "streaks",
    });
  }
};

module.exports = {
  isNewWeek,
  isPartOfStreak,
  findWorkOutById,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
};
