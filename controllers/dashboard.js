const User = require("../models/user");
const userAcheivements = require("../models/userAcheivements");
const WorkoutLog = require("../models/userWorkOutLog");
const moment = require("moment");

// const topWinUsers = async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit) || 10;

//     // Aggregation pipeline to find top users by totalWorkouts
//     const topUsers = await User.aggregate([
//       {
//         $sort: { totalWorkouts: -1 },
//       },
//       {
//         $limit: limit,
//       },
//       {
//         $project: {
//           email: 1,
//           totalWorkouts: 1,
//           username: 1,
//         },
//       },
//     ]);
//     return res.status(200).json(topUsers);
//   } catch (error) {
//     return res.status(500).json({ msg: "Error Finding Top Winners", error });
//   }
// };

const topWinUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // Default to 5 users
    const timePeriod = req.query.timePeriod || "1_week"; // Default to 1 week

    let dateFilter = {};

    // Set date filter based on time period
    if (timePeriod === "1_week") {
      dateFilter = {
        completedAt: { $gte: moment().subtract(1, "weeks").toDate() },
      };
    } else if (timePeriod === "1_month") {
      dateFilter = {
        completedAt: { $gte: moment().subtract(1, "months").toDate() },
      };
    } else if (timePeriod === "1_year") {
      dateFilter = {
        completedAt: { $gte: moment().subtract(1, "years").toDate() },
      };
    }

    // Aggregation pipeline to find top users by completed workouts
    const topUsers = await WorkoutLog.aggregate([
      {
        $match: {
          completed: true, // Only count completed workouts
          ...dateFilter, // Filter by the selected time period
        },
      },
      {
        $group: {
          _id: "$userId", // Group by userId
          completedWorkouts: { $sum: 1 }, // Count completed workouts for each user
        },
      },
      {
        $sort: { completedWorkouts: -1 }, // Sort by number of completed workouts (highest first)
      },
      {
        $limit: limit, // Limit the result set to the top users
      },
      {
        $lookup: {
          from: "users", // Lookup user details from the User collection
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user", // Unwind the user array
      },
      {
        $project: {
          username: "$user.username", // Include username
          email: "$user.email", // Include email
          totalWorkouts: "$completedWorkouts", // Include completed workouts count
        },
      },
    ]);

    return res.status(200).json(topUsers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Error Finding Top Users", error });
  }
};

const userWeeklyWorkoutGoal = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const users = await User.find(
      {},
      {
        username: 1,
        email: 1,
        weeklyWorkOutGoal: 1,
        totalWorkouts: 1,
        streaks: 1,
      }
    )
      .skip(skip)
      .limit(limit);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ msg: "Error Fetching Users", error });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const users = await User.find(
      {},
      {
        username: 1,
        email: 1,
        lastActiveAt: 1,
        totalWorkouts: 1,
        workoutsInWeek: 1,
        streaks: 1,
        personalBestCounter: 1,
      }
    )
      .skip(skip)
      .limit(limit);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ msg: "Error Fetching Users", error });
  }
};

const userRecentAcheivement = async (req, res) => {
  try {
    const startOfMonth = moment().startOf("month").toDate(); // Start of the current month
    const endOfMonth = moment().endOf("month").toDate(); // End of the current month
    const limit = req.query.limit;
    const recentAcheivements = await userAcheivements.aggregate([
      {
        $match: {
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      // Group by userId and get the most recent achievement
      {
        $group: {
          _id: "$userId", // Group by userId
          mostRecentAchievement: {
            $first: {
              achievementType: "$acheivementType",
              date: "$date",
              category: "$category",
            },
          },
        },
      },
      // Lookup to join with User collection to get user details
      {
        $lookup: {
          from: "users",
          localField: "_id", // Field from the achievements collection
          foreignField: "_id", // Field from the users collection
          as: "userDetails", // Name of the new array field to add
        },
      },
      // Unwind the userDetails array to get individual user details
      {
        $unwind: "$userDetails",
      },
      // Project fields to include in the result
      {
        $project: {
          _id: 0, // Exclude the _id field from the result
          userId: "$_id",
          username: "$userDetails.username",
          email: "$userDetails.email",
          mostRecentAchievement: 1,
        },
      },
      {
        $limit: parseInt(limit, 10),
      },
    ]);
    res.status(200).json(recentAcheivements);
  } catch (error) {
    console.log(error);

    res.status(500).json({ msg: "Error Fetching Recent Acheivements", error });
  }
};

module.exports = {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
};
