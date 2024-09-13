const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Tab = require("../models/tabSection");
const { TAB_JWT_SECRET } = require("../config/config");
const User = require("../models/user");
const WorkoutLog = require("../models/userWorkOutLog");

const {
  findWorkOutById,
  isNewWeek,
  isPartOfStreak,
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

    // Fetch today's workout details
    const {
      workout: todaysWorkout,
      programId,
      weekNumber,
    } = await fetchUserTodaysWorkout(res);

    // Access the stations array
    const stations = todaysWorkout.stations;

    const targetStationNumber = tab.stationNumber;
    const stationIndex = stations.findIndex(
      (station) => station.stationNumber === targetStationNumber
    );

    // Check if the station is completed
    const completedStations = await WorkoutLog.findOne({
      userId: user._id,
      workOutId: todaysWorkout._id,
      "stations.stationNumber": targetStationNumber,
    });

    let workout = {
      station: {
        ...todaysWorkout.stations[stationIndex],
        completed: !!completedStations, // Mark station as completed if it exists in the log
      },
      userId: user._id,
      weekNumber: weekNumber,
      programId: programId,
      workOutId: todaysWorkout._id,
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
    const { workOutId, userId, station, weekNumber, programId } = req.body;
    const tabId = req.tabId;

    const tab = await Tab.findOne({ tabId });
    if (!tab) {
      return res.status(500).json({ msg: "Tab not found" });
    }

    if (tab.stationNumber !== station.stationNumber) {
      return res.status(500).json({
        msg: `Station Number: ${station.stationNumber} and tab's station number: ${tab.stationNumber} are not the same`,
      });
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

    // Find or create a workout log for the user
    let workoutLog = await WorkoutLog.findOne({ userId, workOutId });

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

    // Mark the station as complete and add it to the workout log
    station.completed = true;
    workoutLog.stations.push(station);

    // Save the updated workout log
    await workoutLog.save();

    // Update user's workout metrics
    user.lastWorkoutDate = new Date();
    await user.save();

    return res.status(200).json({ msg: "Station data saved successfully" });
  } catch (error) {
    console.error("Error saving workout:", error);
    res.status(500).json({ message: "Failed to save station data" });
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

module.exports = {
  createTab,
  loginToTab,
  userLoginToTab,
  saveWorkout,
  deleteTab,
  changePassword,
  getAllTabs,
};
