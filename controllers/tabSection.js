const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Tab = require("../models/tabSection");
const { TAB_JWT_SECRET } = require("../config/config");
const User = require("../models/user");
const WorkoutLog = require("../models/userWorkOutLog");

const {
  findWorkOutById,
  isNewWeek,
  checkAndAddStreakAchievements,
  checkAndAddWeeklyAchievements,
  checkAndAddWorkoutAchievements,
  checkAndAddPersonalBestAwards,
  fetchUserTodaysWorkout,
} = require("../utils/userWorkOutLog");

const createTab = async (req, res) => {
  try {
    const { password, tabId, stationNumber, confirmPassword } = req.body;
    if (!password || !tabId || !confirmPassword || !stationNumber) {
      return res.status(500).json({ msg: "please provide all fields values" });
    }
    if (password !== confirmPassword) {
      return res.status(500).json({ msg: "password does match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Hash the tab password
    const tabs = await Tab.find();
    const newTab = new Tab({
      tabId: tabId,
      password: hashedPassword,
      stationNumber: stationNumber,
    });
    await newTab.save();
    res.status(201).json({ message: "Tab created successfully", tab: newTab });
  } catch (error) {
    console.error("Error creating tab:", error);
    res.status(500).json({ message: "Failed to create tab" });
  }
};

//get all tabs
const getAllTabs = async (req, res) => {
  try {
    const tabs = await Tab.find({});
    console.log(tabs);

    res.status(200).json(tabs);
  } catch (error) {
    res.status(500).json({ msg: "unable retreive tabs" });
  }
};

const loginToTab = async (req, res) => {
  try {
    const { tabId, password } = req.body;

    // Find the tab
    const tab = await Tab.findOne({ tabId });
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Verify tab password
    const isMatch = await bcrypt.compare(password, tab.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid tab password" });

    // Generate a JWT token with tabId
    const token = jwt.sign({ tabId }, TAB_JWT_SECRET, { expiresIn: "1d" });
    res.json({ msg: "tab logged in successfully", token });
  } catch (error) {
    console.error("Error logging in to tab:", error);
    res.status(500).json({ message: "Failed to log in to tab" });
  }
};
const userLoginToTab = async (req, res) => {
  try {
    const { tabId } = req;
    const { username } = req.body;

    // Find the tab and check if token matches
    const tab = await Tab.findOne({ tabId });
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Find the user
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Associate user with tab session
    tab.loggedInUser = user._id;
    await tab.save();

    const workoutLog = await WorkoutLog.find({
      userId: user._id,
    });

    // Fetch today's workout details
    const {
      workout: todaysWorkout,
      programId,
      weekNumber,
    } = await fetchUserTodaysWorkout(res);

    let existingStation = null;

    for (const log of workoutLog) {
      // Check if the log matches the current workout, program, and user
      if (
        log.workOutId.toString() === todaysWorkout._id.toString() &&
        log.programId.toString() === programId.toString() &&
        log.userId.toString() === user._id.toString()
      ) {
        existingStation = log.stations.find(
          (station) =>
            station.stationNumber === tab.stationNumber &&
            station.completed === true
        );
        if (existingStation) break;
      }
    }

    if (existingStation) {
      return res.status(200).json({
        message: "Station data already saved",
        workout: {
          station: existingStation,
          userId: user._id,
          weekNumber: existingStation.weekNumber, // Use the existing station's weekNumber
          programId: existingStation.programId, // Use the existing station's programId
          workOutId: existingStation.workOutId, // Use the existing station's workOutId
          completed: true,
          measurementType: existingStation.exercises[0].sets[0].measurementType,
        },
      });
    }

    // Access the stations array
    const stations = todaysWorkout.stations;
    const targetStationNumber = tab.stationNumber;
    const stationIndex = stations.findIndex(
      (station) => station.stationNumber === targetStationNumber
    );

    // Ensure we have a valid station index
    if (stationIndex === -1) {
      return res
        .status(404)
        .json({ message: "Station not found in today's workout" });
    }

    // Build the workout object including all exercises for the station
    let workout = {
      station: {
        stationNumber: todaysWorkout.stations[stationIndex].stationNumber,
        completed: false,
        exercises: todaysWorkout.stations[stationIndex].exercises.map(
          (exercise) => ({
            exerciseName: exercise.exerciseName,
            sets: exercise.sets
              .filter((set) => set.level === "Level 1") // Only include Beginner sets
              .map((set) => {
                let setData = {
                  measurementType: set.measurementType,
                  previous: set.previous || 0, // default
                  lbs: set.lbs || 0,
                  level: set.level, // default
                  _id: set._id,
                };

                // Add specific fields based on measurement type
                if (set.measurementType === "Time") {
                  setData.time = set.value;
                } else if (set.measurementType === "Reps") {
                  setData.reps = set.value;
                } else if (set.measurementType === "Distance") {
                  setData.distance = set.value;
                }

                return setData;
              }),
          })
        ),
      },
      userId: user._id,
      weekNumber: weekNumber,
      programId: programId,
      workOutId: todaysWorkout._id,
      measurementType:
        todaysWorkout.stations[stationIndex].exercises[0].sets[0]
          .measurementType,
      completed: false,
    };

    res.status(200).json({
      message: "User logged in successfully",
      workout,
    });
  } catch (error) {
    console.error("Error logging in user to tab:", error);
    res.status(500).json({ message: "Failed to log in user to tab" });
  }
};

const saveWorkout = async (req, res) => {
  try {
    const { workOutId, userId, weekNumber, programId, station } = req.body;
    const tabId = req.tabId;
    const previousWorkouts = await WorkOutLog.find({ userId });

    const tab = await Tab.findOne({ tabId });
    if (!tab) {
      return res.status(500).json({ msg: "Tab not found" });
    }

    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(500).json({ msg: "User not found" });
    }

    // Fetch workout by ID
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(500).json({ msg: "Workout not found" });
    }

    // Check if the station has an exercise and the exercise has sets
    if (station.exercises.length == 0) {
      return res.status(400).json({ msg: "Station must have an exercise." });
    }

    // Validate station number against tab
    if (station.stationNumber !== tab.stationNumber) {
      return res.status(400).json({
        msg: `Cannot save data for this station ${station.stationNumber} into a different tab ${tab.stationNumber}.`,
      });
    }

    // Validate each exercise and its sets
    for (const exercise of station.exercises) {
      if (!Array.isArray(exercise.sets) || exercise.sets.length === 0) {
        return res
          .status(400)
          .json({ msg: "Each exercise must have at least one set." });
      }

      for (const set of exercise.sets) {
        if (typeof set.reps !== "number" || typeof set.lbs !== "number") {
          return res
            .status(400)
            .json({ msg: "Each set must have valid reps and lbs." });
        }
      }
    }

    // Find or create a workout log for the user
    let workoutLog = await WorkoutLog.findOne({
      userId,
      workOutId,
      weekNumber,
    });

    if (!workoutLog) {
      workoutLog = new WorkoutLog({
        userId,
        programId,
        weekNumber,
        workOutId,
        numberOfStations: fetchedWorkOut.workout.numberOfStations,
        stations: [],
        completed: false,
        completedAt: null,
      });
    }

    // Check if the station has already been saved
    const existingStation = workoutLog.stations.find(
      (std) => std.stationNumber === station.stationNumber
    );
    if (existingStation) {
      return res.status(200).json({ msg: "Station data already saved" });
    }

    // Mark the station as completed and add it to the workout log
    station.completed = true;
    workoutLog.stations.push(station);

    // Check if all stations have been filled
    if (workoutLog.stations.length === workoutLog.numberOfStations) {
      workoutLog.completed = true;
      workoutLog.completedAt = new Date();

      // Increment total workouts
      user.totalWorkouts += 1;

      // Checking if the workout is in a new week
      if (isNewWeek(user.lastWorkoutDate)) {
        user.workoutsInWeek = 1; // Reset to 1 for the first workout of the week
      } else {
        user.workoutsInWeek += 1; // Increment weekly count
      }
      user.lastWorkoutDate = new Date();

      await user.save();
      await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
      await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
      await checkAndAddStreakAchievements(user._id, user.streaks);
      await checkAndAddPersonalBestAwards({
        userId: user._id,
        newWorkout: workoutLog,
        previousWorkouts,
      });
    }

    // Save the updated workout log
    await workoutLog.save();

    return res.status(200).json({ msg: "Station data saved successfully" });
  } catch (error) {
    console.error("Error saving workout:", error);
    res
      .status(500)
      .json({ message: "Failed to save station data", error: error.message });
  }
};

const deleteTab = async (req, res) => {
  try {
    const tabId = req.params.tabId;
    const tab = await Tab.findOneAndDelete({ _id: tabId });
    if (!tab) {
      res.status(404).json({ message: "Tab not found" });
    }
    res.status(200).json({ msg: "Tab deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete tab" });
  }
};

const changePassword = async (req, res) => {
  try {
    const tabId = req.params.tabId;
    const { newPassword, confirmPassword } = req.body;
    const tab = await Tab.findOne({ _id: tabId });
    if (!tab) {
      return res.status(404).json({ msg: "tab not found" });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(500).json({ msg: "please provide all fields values" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(500).json({ msg: "passwords does not match" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the tab password

    await Tab.findOneAndUpdate(
      { _id: tabId },
      { $set: { password: hashedPassword } }
    );
    res.status(200).json({ msg: "password changed successfully" });
  } catch (error) {
    console.log("change password error:", error);

    return res.status(500).json({ msg: "unable to change password" });
  }
};

const getAllUsernames = async (req, res) => {
  try {
    const users = await User.find();
    const usernames = users.map((user) => {
      return user.username;
    });
    res.status(200).json({ usernames: usernames });
  } catch (error) {
    return res.status(500).json({ msg: "unable to get usernames" });
  }
};

module.exports = {
  createTab,
  loginToTab,
  userLoginToTab,
  saveWorkout,
  deleteTab,
  changePassword,
  getAllTabs,
  getAllUsernames,
};
