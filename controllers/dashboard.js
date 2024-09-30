const User = require("../models/user");
const userAcheivements = require("../models/userAcheivements");
const WorkoutLog = require("../models/userWorkOutLog");
const moment = require("moment");
const ExerciseName = require("../models/exerciesNames");

/**
 * @route   GET /dashboard/top-win-users
 * @desc    Retrieves the top users with the highest number of completed workouts
 *          within a specified time period (default is 1 week). The result is
 *          sorted by the total number of completed workouts, in descending order.
 *
 * @queryParam {number} [limit=5] - The maximum number of top users to return (optional, default: 5).
 * @queryParam {string} [timePeriod=1_week] - The time period to filter results by:
 *           - "1_week" (default): Returns users who completed the most workouts in the last week.
 *           - "1_month": Returns users who completed the most workouts in the last month.
 *           - "all_time": Returns users with the most workouts completed of all time.
 *
 * @returns {Object[]} - Returns an array of top users with their usernames, emails, and total completed workouts.
 *
 * @example
 *  Example GET request:
 * /dashboard/top-win-users?limit=3&timePeriod=1_month
 *
 * @response {Object[]} topUsers - Array of top users with their details:
 *    - username: User's username.
 *    - email: User's email.
 *    - totalWorkouts: Total number of completed workouts within the specified time period.
 *
 * @throws {500} - Returns an error message if there's an issue fetching top users.
 */

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
    } else if (timePeriod === "all_time") {
      // No date filter for all time
      dateFilter = {};
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

/**
 * @route   GET /dashboard/user-workout-goal
 * @desc    Retrieves a paginated list of users with their workout-related information,
 *          including their username, email, weekly workout goals, total workouts completed,
 *          and workout streaks.
 *
 * @queryParam {number} [page=1] - The page number for pagination (optional, default: 1).
 * @queryParam {number} [limit=10] - The number of users to return per page (optional, default: 10).
 *
 * @returns {Object[]} - Returns an array of users with their workout goal data.
 *
 * @example
 *  Example GET request:
 *  /dashboard/user-workout-goal?page=2&limit=5
 *
 * @response {Object[]} users - Array of users with their workout goal details:
 *    - username: User's username.
 *    - email: User's email.
 *    - weeklyWorkOutGoal: User's weekly workout goal.
 *    - totalWorkouts: Total number of workouts completed by the user.
 *    - streaks.
 *
 * @throws {500} - Returns an error message if there's an issue fetching users' data.
 */

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

/**
 * @route   GET /dashboard/all-users
 * @desc    Retrieves a paginated list of all users with key workout and activity information,
 *          including username, email, last activity date, total workouts, weekly workouts,
 *          workout streaks, and personal best count.
 *
 * @queryParam {number} [page=1] - The page number for pagination (optional, default: 1).
 * @queryParam {number} [limit=10] - The number of users to return per page (optional, default: 10).
 *
 * @returns {Object[]} - Returns an array of users with their workout-related details.
 *
 * @example
 *  Example GET request:
 *  /dashboard/all-users?page=3&limit=5
 *
 * @response {Object[]} users - Array of users with their workout and activity data:
 *    - username: User's username.
 *    - email: User's email address.
 *    - lastActiveAt: The last date the user was active.
 *    - totalWorkouts: The total number of workouts completed by the user.
 *    - workoutsInWeek: The number of workouts completed in the current week.
 *    - streaks: The number of consecutive workout weeks.
 *    - personalBestCounter: The total number of personal bests achieved by the user.
 *
 * @throws {500} - Returns an error message if there's an issue fetching the users' data.
 */

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

/**
 * @route   GET /dashboard/recent-acheivements
 * @desc    Retrieves the most recent achievements of users within the current month.
 *          Achievements are sorted by the most recent date, and the result includes user details.
 *
 * @queryParam {number} [limit] - The number of recent achievements to retrieve (optional, default: unlimited).
 *
 * @returns {Object[]} - Returns an array of users with their most recent achievements.
 *
 * @example
 *  Example GET request:
 *  /dashboard/recent-acheivements?limit=10
 *
 * @response {Object[]} - An array of objects representing users' recent achievements:
 *    - userId: The unique identifier of the user.
 *    - username: The user's username.
 *    - email: The user's email.
 *    - mostRecentAchievement: The user's most recent achievement details, including:
 *      - achievementType: The type of achievement (e.g., streak, personal best).
 *      - date: The date of the achievement.
 *      - category: The category of the achievement.
 *
 * @throws {500} - Returns an error message if there's an issue fetching recent achievements.
 */

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

/**
 * @route   POST /dashboard/add-exercise
 * @desc    Adds a new exercise with its corresponding sets. Validates that all sets have the same measurement type (e.g., 'Reps', 'Time', or 'Distance').
 *
 * @bodyParam {string} exerciseName - The name of the exercise (required).
 * @bodyParam {Array} sets - An array of sets for the exercise (required). Each set must have the same `measurementType`.
 *
 * @returns {Object} - Returns a success message along with the newly added exercise details if valid.
 *
 * @example
 *  Example POST request:
 *  {
 *    "exerciseName": "Push Up",
 *    "sets": [
 *      { "measurementType": "Reps", "reps": 15 },
 *      { "measurementType": "Reps", "reps": 12 }
 *    ]
 *  }
 *
 * @response {201} - Exercise added successfully.
 * @response {400} - Returns an error if `exerciseName` or `sets` are missing, or if sets have different `measurementType`.
 * @response {500} - Returns an error message if there's an issue adding the exercise.
 */

const addExercise = async (req, res) => {
  const { exerciseName, sets } = req.body;

  try {
    // Validate that name and sets are provided
    if (!exerciseName || !sets || sets.length === 0) {
      return res
        .status(400)
        .json({ error: "Exercise name and sets are required" });
    }

    // Check if all sets have the same measurementType
    const firstMeasurementType = sets[0].measurementType; // Get the measurementType of the first set
    const allSameMeasurementType = sets.every(
      (set) => set.measurementType === firstMeasurementType
    );

    if (!allSameMeasurementType) {
      return res.status(400).json({
        error:
          "All sets must have the same measurement type (e.g., all 'Reps', 'Time', or 'Distance').",
      });
    }

    // Create and save the new exercise
    const newExercise = new ExerciseName({ exerciseName, sets });
    await newExercise.save();

    res
      .status(201)
      .json({ message: "Exercise added successfully", exercise: newExercise });
  } catch (error) {
    res.status(500).json({ error: "Error adding exercise", details: error });
  }
};

/**
 * @route   GET /dashboard/all-exercises
 * @desc    Fetches all exercises stored in the database.
 *
 * @returns {Object} - Returns a list of all exercises.
 *
 * @response {200} - A list of exercises is successfully retrieved.
 * @response {404} - No exercises found in the database.
 * @response {500} - Returns an error message if there's an issue fetching the exercises.
 *
 * @example
 *  Example successful response:
 *  {
 *    "exercises": [
 *      { "exerciseName": "Push Up", "sets": [...] },
 *      { "exerciseName": "Squat", "sets": [...] }
 *    ]
 *  }
 */

const getAllExercise = async (req, res) => {
  try {
    // Fetch all exercises from the database
    const exercises = await ExerciseName.find({});

    if (!exercises || exercises.length === 0) {
      return res.status(404).json({ message: "No exercises found" });
    }

    res.status(200).json({ exercises });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching exercises", details: error.message });
  }
};

/**
 * @route   Patch /dashboard/update-exercise/:exerciseId
 * @desc    Updates an existing exercise with new data.
 *
 * @param   {string} exerciseId - The ID of the exercise to be updated.
 * @body    {string} exerciseName - The new name for the exercise.
 * @body    {Array} sets - An array of sets associated with the exercise.
 *
 * @returns {Object} - Returns the updated exercise data.
 *
 * @response {200} - The exercise was successfully updated.
 * @response {400} - Bad request if the exercise name or sets are not provided or if sets have different measurement types.
 * @response {404} - Exercise not found in the database.
 * @response {500} - Returns an error message if there's an issue updating the exercise.
 *
 * @example
 *  Example successful response:
 *  {
 *    "message": "Exercise updated successfully",
 *    "exercise": {
 *      "_id": "exerciseId",
 *      "exerciseName": "Updated Exercise Name",
 *      "sets": [...]
 *    }
 *  }
 */

const updateExercise = async (req, res) => {
  const { exerciseId } = req.params; // The ID of the exercise to update
  const { exerciseName, sets } = req.body; // The new data for the exercise

  try {
    // Validate that exercise name and sets are provided
    if (!exerciseName || !sets || sets.length === 0) {
      return res
        .status(400)
        .json({ error: "Exercise name and sets are required" });
    }

    // Validate that all sets have the same measurementType
    const firstMeasurementType = sets[0].measurementType;
    const allSameMeasurementType = sets.every(
      (set) => set.measurementType === firstMeasurementType
    );

    if (!allSameMeasurementType) {
      return res.status(400).json({
        error:
          "All sets must have the same measurement type (e.g., all 'Reps', 'Time', or 'Distance').",
      });
    }

    // Find and update the exercise by ID
    const updatedExercise = await ExerciseName.findByIdAndUpdate(
      exerciseId,
      { exerciseName, sets }, // Fields to update
      { new: true, runValidators: true } // Return the updated document
    );

    if (!updatedExercise) {
      return res.status(404).json({ error: "Exercise not found" });
    }

    res.status(200).json({
      message: "Exercise updated successfully",
      exercise: updatedExercise,
    });
  } catch (error) {
    console.error("Error updating exercise:", error);
    res.status(500).json({ error: "Error updating exercise", details: error });
  }
};

/**
 * @route   DELETE /dashboard/delete-exercise/:exerciseId
 * @desc    Deletes an existing exercise from the database.
 *
 * @param   {string} exerciseId - The ID of the exercise to be deleted.
 *
 * @returns {Object} - Returns a success message upon successful deletion.
 *
 * @response {200} - The exercise was successfully deleted.
 * @response {404} - Exercise not found in the database.
 * @response {500} - Returns an error message if there's an issue deleting the exercise.
 *
 * @example
 *  Example successful response:
 *  {
 *    "message": "Exercise deleted successfully"
 *  }
 */

const deleteExercise = async (req, res) => {
  const { exerciseId } = req.params; // The ID of the exercise to delete

  try {
    // Find and delete the exercise by ID
    const deletedExercise = await ExerciseName.findByIdAndDelete(exerciseId);

    if (!deletedExercise) {
      return res.status(404).json({ error: "Exercise not found" });
    }

    res.status(200).json({
      message: "Exercise deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting exercise:", error);
    res.status(500).json({ error: "Error deleting exercise", details: error });
  }
};

module.exports = {
  topWinUsers,
  userWeeklyWorkoutGoal,
  getAllUsers,
  userRecentAcheivement,
  addExercise,
  getAllExercise,
  updateExercise,
  deleteExercise,
};
