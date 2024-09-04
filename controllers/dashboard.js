const User = require("../models/user");
const userAcheivements = require("../models/userAcheivements");
const moment = require("moment");

const topWinUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Aggregation pipeline to find top users by totalWorkouts
    const topUsers = await User.aggregate([
      {
        $sort: { totalWorkouts: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          email: 1,
          totalWorkouts: 1,
        },
      },
    ]);
    return res.status(200).json(topUsers);
  } catch (error) {
    return res.status(500).json({ msg: "Error Finding Top Winners", error });
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
    const startOfWeek = moment().startOf("month").toDate(); // Start of the current month
    const endOfWeek = moment().endOf("month").toDate(); // End of the current month
    const recentAcheivements = await userAcheivements.aggregate([
      {
        $match: {
          date: {
            $gte: startOfWeek,
            $lte: endOfWeek,
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
    ]);
    res.status(200).json(recentAcheivements);
  } catch (error) {
    res.status(500).json({ msg: "Error Fetching Recent Acheivements", error });
  }
};

const getActiveUsers = async (req, res) => {
  try {
    const weeksAgo = parseInt(req.query.weeks, 10) || 1;

    // Calculate the start of the period------> active users in last specified weeks
    const startOfPeriod = moment()
      .subtract(weeksAgo, "weeks")
      .startOf("week")
      .toDate();
    console.log(weeksAgo);
    console.log(startOfPeriod);

    // Group users by the day they were last active within the specified period
    const activeUsers = await User.aggregate([
      {
        $match: {
          lastActive: { $gte: startOfPeriod }, // Match users active since the start of the period
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$lastActive" }, // Group by day of the week (1 = Sunday, 7 = Saturday)
          count: { $sum: 1 }, // Count the number of users
        },
      },
    ]);
    console.log(activeUsers);

    // // Convert MongoDB days to a JavaScript-friendly format
    // const dayMap = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
    // const formattedData = activeUsers.map(item => ({
    //   day: dayMap[item._id],
    //   count: item.count,
    // }));

    res.json({ activeUsers });
  } catch (error) {
    console.error("Error fetching active users stats:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve active user statistics" });
  }
};

module.exports = {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
  getActiveUsers,
};
