const moment = require("moment");
const User = require("../models/user");
const Acheivements = require("../models/userAcheivements");
const WorkoutLog = require("../models/userWorkOutLog");
const Program = require("../models/program");
const mongoose = require("mongoose");

/**
 * Retrieves a specific workout by its ID from the database.
 * Searches all programs to find the workout, returning its details
 * and associated week number if found; returns false if not found.
 *
 * @param {String} workOutId - The ID of the workout to find.
 * @param {Object} res - The response object to send back data.
 * @returns {Object|Boolean} - Workout details or false.
 */
const findWorkOutById = async (workOutId, res) => {
  // Find the program containing the workout with the given ID
  const program = await Program.findOne({
    "weeks.workouts._id": new mongoose.Types.ObjectId(workOutId),
  }).lean(); // Use lean() for better performance

  if (!program) {
    return false;
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
    return false;
  }

  return {
    workout,
    weekNumber,
    programTitle: program.title,
    programId: program._id,
  };
};

/**
 * Checks if a new week has started based on the last workout date.
 *
 * @param {Date} lastWorkoutDate - The date of the last workout.
 * @returns {Boolean} - True if a new week has started, else false.
 */
const isNewWeek = (lastWorkoutDate) => {
  const currentDate = moment();
  const startOfCurrentWeek = currentDate.clone().startOf("week");
  const startOfLastWeek = moment(lastWorkoutDate).startOf("week");

  return startOfLastWeek.isBefore(startOfCurrentWeek);
};

/**
 * Determines if the last workout date is part of a continuous streak.
 *
 * @param {Date} lastWorkoutDate - The date of the last workout.
 * @returns {Boolean} - True if last workout was yesterday, else false.
 */
const isPartOfStreak = (lastWorkoutDate) => {
  // Assuming streaks are based on consecutive weeks of workouts
  const currentDate = moment().startOf("day"); // Get current date without time
  const lastWorkoutMoment = moment(lastWorkoutDate).startOf("day"); // Get last workout date without time
  console.log(currentDate, lastWorkoutMoment);

  const diffInDays = currentDate.diff(lastWorkoutMoment, "days") === 1;
  return diffInDays;
};

/**
 * Updates the user's workout streak based on their weekly goal.
 *
 * @param {String} userId - The ID of the user whose streak is to be updated.
 * @returns {Promise<void>}
 */
const updateUserStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    // Check if workoutsInWeek meets or exceeds the user's weekly goal
    if (user.workoutsInWeek >= user.weeklyWorkOutGoal) {
      user.streaks += 1; // Increment streak
    } else {
      user.streaks = 0; // Reset streak if goal not met
    }
    // Reset workoutsInWeek for the new week
    user.workoutsInWeek = 0;
    await user.save();
  } catch (error) {
    console.error("Error updating user streak:", error);
  }
};

/**
 * Adds a new achievement for the user in the database.
 *
 * @param {String} userId - The ID of the user for whom the achievement is being added.
 * @param {Object} newAchievement - The new achievement details to be added.
 * @returns {Promise<void>}
 */
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

/**
 * Checks if the user has reached workout completion milestones and adds achievements.
 *
 * @param {String} userId - The ID of the user.
 * @param {Number} workoutsCompleted - The total number of workouts completed by the user.
 * @returns {Promise<void>}
 */
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

/**
 * Checks if the user has reached specific weekly workout milestones and adds achievements.
 *
 * @param {String} userId - The ID of the user.
 * @param {Number} workoutsInWeek - The number of workouts completed in the week.
 * @returns {Promise<void>}
 */
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

/**
 * Checks if the user has reached specific streak milestones and adds achievements.
 *
 * @param {String} userId - The ID of the user.
 * @param {Number} streak - The current streak count.
 * @returns {Promise<void>}
 */
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

/**
 * Checks for new personal bests and updates achievements accordingly.
 *
 * @param {Object} params - Contains userId, newWorkout, and previousWorkouts.
 * @returns {Promise<void>}
 */
const checkAndAddPersonalBestAwards = async ({
  userId,
  newWorkout,
  previousWorkouts,
}) => {
  try {
    // Fetch the user document
    const user = await User.findById(userId);

    // Determine the next milestone in the sequence
    const milestones = [
      1, 3, 5, 7, 10, 20, 50, 75, 100, 200, 250, 300, 350, 400,
    ];
    const nextMilestone = milestones.find(
      (milestone) => milestone > user.personalBestCounter
    );

    // Initialize the maximum lbs from previous workouts
    let maxLbs = 0;

    // Iterate through previous workouts to find the max lbs
    for (const workout of previousWorkouts) {
      for (const station of workout.stations) {
        for (const exercise of station.exercises) {
          for (const set of exercise.sets) {
            maxLbs = Math.max(maxLbs, set.lbs);
          }
        }
      }
    }

    // Initialize flag for checking personal best
    let isNewPersonalBest = false;

    // Compare the new workout data against the previous max lbs
    for (const station of newWorkout.stations) {
      for (const exercise of station.exercises) {
        for (const set of exercise.sets) {
          const { lbs } = set;

          // Check if the current lbs is greater than the previous maximum
          if (lbs > maxLbs) {
            isNewPersonalBest = true;
            break; // Stop checking once a new best is found
          }
        }
        if (isNewPersonalBest) break; // Stop checking if new personal best is found
      }
      if (isNewPersonalBest) break; // Stop checking if new personal best is found
    }

    // Increment personal best counter and add achievement if milestone is reached
    if (isNewPersonalBest) {
      user.personalBestCounter += 1;

      // Check if the next milestone is reached
      if (user.personalBestCounter === nextMilestone) {
        await addAchievement(userId, {
          acheivementType: `${nextMilestone}`,
          category: "personal_best",
        });
        console.log("New personal best achievement added:", nextMilestone);
      }

      // Save the updated user data
      await user.save();
    }
  } catch (error) {
    console.error("Error checking and adding personal best awards:", error);
  }
};

/**
 * Fetches today's workout details from the program.
 *
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} - An object containing the program ID, week number, and today's workout details.
 * @throws {Error} - Throws an error if no workout is found for today.
 */
const fetchUserTodaysWorkout = async (res) => {
  const startOfDay = moment().startOf("day").toDate();
  const endOfDay = moment().endOf("day").toDate();

  // Find the program that contains today's workouts
  const program = await Program.findOne({
    "weeks.workouts.date": {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).lean();

  if (!program) {
    throw new Error("No workout found for today");
  }

  // Initialize a variable to store today's workout details
  let todaysWorkout = null;
  let weekNumber = null;

  // Iterate through weeks to find today's workout
  for (const week of program.weeks) {
    const workoutForToday = week.workouts.find((workout) => {
      const workoutDate = moment(workout.date).startOf('day').toDate(); // Normalize to start of day
      return workoutDate >= startOfDay && workoutDate <= endOfDay;
    });

    if (workoutForToday) {
      todaysWorkout = workoutForToday;
      weekNumber = week.weekNumber;
      break; // Exit loop once today's workout is found
    }
  }

  if (!todaysWorkout) {
    throw new Error("No workout found for today");
  }

  // Return the program ID, week number, and today's workout
  return {
    programId: program._id,
    weekNumber: weekNumber,
    workout: todaysWorkout,
  };
};


/**
 * Gets the MongoDB filter for a specified time period.
 *
 * @param {string} timePeriod - The time period for filtering (e.g., "1_week", "1_month").
 * @returns {Object} - A MongoDB date query object for the specified time period.
 */
function getTimeFilter(timePeriod) {
  const now = new Date(); // Current date

  switch (timePeriod) {
    case "1_week":
      return { $gte: new Date(now.setDate(now.getDate() - 7)) }; // Last 7 days
    case "1_month":
      return { $gte: new Date(now.setMonth(now.getMonth() - 1)) }; // Last 1 month
    case "6_months":
      return { $gte: new Date(now.setMonth(now.getMonth() - 6)) }; // Last 6 months
    case "1_year":
      return { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }; // Last 1 year
    default:
      return {}; // No time filter if none specified
  }
}

module.exports = {
  isNewWeek,
  isPartOfStreak,
  findWorkOutById,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
  fetchUserTodaysWorkout,
  getTimeFilter,
  updateUserStreak,
};
