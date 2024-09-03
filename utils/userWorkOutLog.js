const moment = require("moment");
const User = require("../models/user");
const Acheivements = require("../models/userAcheivements");
const Program = require("../models/program");
const mongoose = require("mongoose");

// finding specific workout by id
const findWorkOutById = async (workOutId, res) => {
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
  const currentDate = moment().startOf("day"); // Get current date without time
  const lastWorkoutMoment = moment(lastWorkoutDate).startOf("day"); // Get last workout date without time
  console.log(currentDate, lastWorkoutMoment);

  const diffInDays = currentDate.diff(lastWorkoutMoment, "days") === 1;
  return diffInDays;
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
  const workOutMileStones = [1, 5, 10, 25, 50, 100, 200, 300, 400, 500]; // Add more milestones as needed

  if (workOutMileStones.includes(workoutsCompleted)) {
    await addAchievement(userId, {
      acheivementType: `${workoutsCompleted} Workout${
        workoutsCompleted > 1 ? "s" : ""
      }`,
      category: "total_workouts",
    });
  }
};

const checkAndAddWeeklyAchievements = async (userId, workoutsInWeek) => {
  const weeklyMilestones = [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15]; // Add more milestones as needed

  if (weeklyMilestones.includes(workoutsInWeek)) {
    await addAchievement(userId, {
      acheivementType: `${workoutsInWeek} Workout${
        workoutsInWeek > 1 ? "s" : ""
      }`,
      category: "workouts_in_week",
    });
  }
};

const checkAndAddStreakAchievements = async (userId, streak) => {
  if (streak >= 14) {
    await addAchievement(userId, {
      acheivementType: "2 weeks",
      category: "streaks",
    });
  }
  if (streak >= 21) {
    await addAchievement(userId, {
      acheivementType: "3 weeks",
      category: "streaks",
    });
  }
  if (streak >= 42) {
    await addAchievement(userId, {
      acheivementType: "6 weeks",
      category: "streaks",
    });
  }
  if (streak >= 84) {
    await addAchievement(userId, {
      acheivementType: "12 weeks",
      category: "streaks",
    });
  }
};
const checkAndAddPersonalBestAwards = async (userId, totalWorkouts) => {
  const milestones = [1, 3, 5, 10, 20, 50, 75, 100, 150, 200, 250, 300];
  for (const milestone of milestones) {
    if (totalWorkouts === milestone) {
      await addAchievement(userId, {
        acheivementType: `${milestone}`,
        category: "personal_best",
      });
    }
  }
};

module.exports = {
  isNewWeek,
  isPartOfStreak,
  findWorkOutById,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
};
