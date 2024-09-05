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
    const { password, tabId, stationNumber } = req.body;
    if (!password || !tabId) {
      return res.status(500).json({ msg: "please provide all fields values" });
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

const loginToTab = async (req, res) => {
  try {
    const { tabId } = req.params;
    const { password } = req.body;

    // Find the tab
    const tab = await Tab.findOne({ _id: tabId });
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
    const tab = await Tab.findOne({ _id: tabId });
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Find the user
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Associate user with tab session
    tab.loggedInUser = user._id;
    await tab.save();
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
    let workout = {
      station: todaysWorkout.stations[stationIndex], //show specific station on each tab
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
    const tab = await Tab.findOne({ _id: tabId });
    if (!tab) {
      return res.status(500).json({ msg: "tab not found" });
    }

    if (tab.stationNumber !== station.stationNumber) {
      return res.status(500).json({
        msg: `station Number : ${station.stationNumber} and  tab's station number :${tab.stationNumber} are not same`,
      });
    }
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(500).json({ msg: "user not found" });
    }

    // fetch workout by id
    const fetchedWorkOut = await findWorkOutById(workOutId, res);
    if (!fetchedWorkOut) {
      return res.status(500).json({ msg: "Workout not found" });
    }

    // Find or create a placeholder workout log for the user
    let workoutLog = await WorkoutLog.findOne({
      userId,
      workOutId,
    });

    if (!workoutLog) {
      workoutLog = new WorkoutLog({
        userId,
        programId,
        weekNumber,
        workOutId, // Placeholder
        numberOfStations: fetchedWorkOut.workout.numberOfStations,
        stations: [station],
        completed: false,
        completedAt: null,
      });

      await workoutLog.save();
      return res.status(200).json({ msg: "workout saved successfully" });
    }

    const checkForSameStation = workoutLog.stations.find((std) => {
      console.log(station.stationNumber, std.stationNumber);

      return std.stationNumber === station.stationNumber;
    });
    if (checkForSameStation) {
      return res.status(200).json({ msg: "station data already saved" });
    }
    workoutLog.stations.push(station);
    if (workoutLog.stations.length > workoutLog.numberOfStations) {
      return res
        .status(500)
        .json({ message: "Number of stations are more then specified" });
    }

    // Check if all stations have been filled
    if (workoutLog.stations.length === workoutLog.numberOfStations) {
      workoutLog.completed = true;
      workoutLog.completedAt = Date.now(); // Set completion time
      user.totalWorkouts += 1;

      // Checking if the workout is in a new week
      if (isNewWeek(user.lastWorkoutDate)) {
        user.workoutsInWeek = 1; // Reset to 1 since this is the first workout of the week
      } else {
        user.workoutsInWeek += 1; // Incrementing the weekly count
      }

      // Updating streaks based on conditions
      if (isPartOfStreak(user.lastWorkoutDate)) {
        user.streaks += 1;
        console.log("streak added");
      } else {
        user.streaks = 1; // Reset streak if there's a gap
      }
      user.lastWorkoutDate = new Date();

      await user.save();
      await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
      await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
      await checkAndAddStreakAchievements(user._id, user.streaks);
      await checkAndAddPersonalBestAwards(user._id, user.totalWorkouts);
    }
    await workoutLog.save();
    return res.status(200).json({ msg: "workout saved successfully" });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Failed to add data to station" });
  }
};

const deleteTab = async (req, res) => {
  try {
    const tabId = req.params.tabId;
    const tab = await Tab.findOneAndDelete({ _id: tabId });
    if (!tab) {
      res.status(404).json({ message: "Tab not found" });
    }

    // Fetch all remaining tabs and sort by their current tabNumber
    const remainingTabs = await Tab.find().sort({ tabNumber: 1 });

    res.status(200).json({ msg: "Tab deleted and station numbers reassigned" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete tab" });
  }
};

const changePassword = async (req, res) => {
  try {
    const tabId = req.tabId;
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
};
