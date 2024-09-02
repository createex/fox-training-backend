const User = require("../models/user");

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
  res.json({ msg: "workign" });
};

module.exports = {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
};
