const moment = require("moment");
const User = require("../models/user");
const Acheivements = require("../models/userAcheivements");
const WorkoutLog = require("../models/userWorkOutLog");
const Program = require("../models/program");
const mongoose = require("mongoose");

// finding specific workout by id
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
// const checkAndAddPersonalBestAwards = async (userId, totalWorkouts) => {
//   const milestones = [1, 3, 5, 10, 20, 50, 75, 100, 150, 200, 250, 300];
//   for (const milestone of milestones) {
//     if (totalWorkouts === milestone) {
//       await addAchievement(userId, {
//         acheivementType: `${milestone}`,
//         category: "personal_best",
//       });
//     }
//   }
// };
const checkAndAddPersonalBestAwards = async ({
  userId,
  newWorkout,
  previousWorkouts,
}) => {
  try {
    // Fetch the latest personal best achievement for the user
    const user = await User.findById(userId);

    // Determine the next milestone in the sequence
    const milestones = [
      1, 3, 5, 7, 10, 20, 50, 75, 100, 200, 250, 300, 350, 400,
    ];
    const nextMilestone = milestones.find(
      (milestone) => milestone > user.personalBestCounter
    );

    // Determine the maximum values for reps and lbs
    let maxReps = 0;
    let maxLbs = 0;
    for (const workout of previousWorkouts) {
      for (const station of workout.stations) {
        for (const set of station.sets) {
          maxReps = Math.max(maxReps, set.reps);
          maxLbs = Math.max(maxLbs, set.lbs);
        }
      }
    }

    // Initialize flags for checking personal best
    let isNewPersonalBest = false;
    // Compare current workout data against previous best values
    for (const station of newWorkout.stations) {
      for (const set of station.sets) {
        const { lbs, reps } = set;
        // Check if either reps or lbs is greater than the previous maximum
        if (reps > maxReps || lbs > maxLbs) {
          isNewPersonalBest = true;
          break; // No need to check further once a new best is found
        }
      }
      if (isNewPersonalBest) break;
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
    return res.status(404).json({ message: "No workout found for today" });
  }

  // Initialize a variable to store today's workout details
  let todaysWorkout = null;
  let weekNumber = null;
  let workoutId = null;

  // Iterate through weeks to find today's workout
  for (const week of program.weeks) {
    const workoutForToday = week.workouts.find((workout) =>
      moment(workout.date).isBetween(startOfDay, endOfDay, null, "[]")
    );

    if (workoutForToday) {
      todaysWorkout = workoutForToday;
      weekNumber = week.weekNumber;
      break; // Exit loop once today's workout is found
    }
  }

  if (!todaysWorkout) {
    return res.status(404).json({ message: "No workout found for today" });
  }

  // Return the program ID, week number, and today's workout
  return {
    programId: program._id,
    weekNumber: weekNumber,
    workout: todaysWorkout,
  };
};

module.exports = {
  isNewWeek,
  isPartOfStreak,
  findWorkOutById,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
  fetchUserTodaysWorkout,
};
