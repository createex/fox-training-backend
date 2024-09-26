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
  updateUserStreak,
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
      level: "Beginner",
    });

    // Fetch today's workout details
    const {
      workout: todaysWorkout,
      programId,
      weekNumber,
    } = await fetchUserTodaysWorkout(res);
    // console.log("todaysss workout ", JSON.stringify(todaysWorkout));

    let existingWeekNumber;
    let existingProgramId;
    let existingWorkoutId;
    let existingLevel;
    // Check if the station has already been saved
    let existingStation = null;
    for (const log of workoutLog) {
      // Exit the loop if a completed station is found
      if (
        log.workOutId.toString() === todaysWorkout._id.toString() &&
        log.programId.toString() === programId.toString() &&
        log.userId.toString() === user._id.toString()
      ) {
        existingProgramId = log.programId;
        existingWeekNumber = log.weekNumber;
        existingWorkoutId = log.workOutId;
        existingLevel = log.level;
        existingStation = log.stations.find(
          (station) =>
            station.completed === true &&
            station.stationNumber === tab.stationNumber
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
          weekNumber: existingWeekNumber,
          programId: existingProgramId,
          workOutId: existingWorkoutId,
          completed: true,
          measurementType: existingStation.sets[0].measurementType,
          level: existingLevel,
        },
      });
    }

    // Access the stations array
    const stations = todaysWorkout.stations;

    const targetStationNumber = tab.stationNumber;
    const stationIndex = stations.findIndex(
      (station) => station.stationNumber === targetStationNumber
    );

    let workout = {
      station: {
        exerciseName: todaysWorkout.stations[stationIndex].exerciseName,
        stationNumber: todaysWorkout.stations[stationIndex].stationNumber,
        sets: todaysWorkout.stations[stationIndex].sets
          .filter((set) => set.level === "Beginner") // Only include Beginner sets
          .map((set) => {
            let setData = {
              measurementType: set.measurementType,
              previous: 0, // default
              lbs: 0, // default
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
        _id: todaysWorkout.stations[stationIndex]._id,
        completed: false, // Mark station as completed if applicable
      },
      userId: user._id,
      weekNumber: weekNumber,
      programId: programId,
      workOutId: todaysWorkout._id,
      measurementType:
        todaysWorkout.stations[stationIndex].sets[0].measurementType,
      completed: false,
      level: "Beginner",
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
    const { workOutId, userId, station, weekNumber, programId, level } =
      req.body;
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
    const previousWorkouts = await WorkoutLog.find({ userId, completed: true });

    //check for not completed wrokout
    let unfinishedWorkout = await WorkoutLog.findOne({
      userId,
      workOutId,
      completed: false,
    });

    if (unfinishedWorkout) {
      if (unfinishedWorkout.level !== level) {
        return res.status(500).json({
          msg: `Your ${unfinishedWorkout.level} level workout is not finished yet finish it first`,
        });
      }
    }
    // Find or create a workout log for the user
    let workoutLog = await WorkoutLog.findOne({
      userId,
      workOutId,
      level: level,
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
        level,
      });
    }

    // Check if the station has already been saved
    const existingStation = workoutLog.stations.find(
      (std) =>
        std.stationNumber === station.stationNumber && std.completed == true
    );
    if (existingStation) {
      return res.status(200).json({ msg: "Station data already saved" });
    }

    const firstMeasurementType = station.sets[0].measurementType;
    // Check if all sets in the current station have the same measurementType
    const isValid = station.sets.every(
      (set) => set.measurementType === firstMeasurementType
    );
    if (!isValid) {
      return res.status(400).json({
        error: `All sets in station ${station.stationNumber} must have the same measurement type.`,
      });
    }

    if (workoutLog.level !== level) {
      return res.status(500).json({
        msg: `Your Level for this workout is ${workoutLog.level} You cannot select another level`,
      });
    }

    // Mark the station as complete and add it to the workout log
    station.completed = true;
    workoutLog.stations.push(station);
    if (workoutLog.stations.length === workoutLog.numberOfStations) {
      workoutLog.completed = true;
      // Incrementing total workouts
      user.totalWorkouts += 1;

      // Checking if the workout is in a new week
      if (isNewWeek(user.lastWorkoutDate)) {
        user.workoutsInWeek = 1; // Reset to 1 since this is the first workout of the week
      } else {
        user.workoutsInWeek += 1; // Incrementing the weekly count
      }

      await updateUserStreak(user._id);
      user.lastWorkoutDate = new Date();

      await user.save();
      await checkAndAddWorkoutAchievements(user._id, user.totalWorkouts);
      await checkAndAddWeeklyAchievements(user._id, user.workoutsInWeek);
      await checkAndAddStreakAchievements(user._id, user.streaks);
      // await checkAndAddPersonalBestAwards({
      //   userId: user._id,
      //   newWorkout: workoutLog,
      //   previousWorkouts,
      // });
    }

    // Save the updated workout log
    await workoutLog.save();
    await user.save();

    return res.status(200).json({ msg: "Station data saved successfully" });
  } catch (error) {
    console.error("Error saving workout:", error);
    res
      .status(500)
      .json({ message: "Failecd to save station data", error: error.message });
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

const getLevelData = async (req, res) => {
  try {
    const { level, username } = req.query;
    const { tabId } = req;
    // Find the tab and check if token matches
    const tab = await Tab.findOne({ tabId });
    if (!tab) return res.status(404).json({ message: "Tab not found" });

    // Find the user
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const workoutLog = await WorkoutLog.find({ userId: user._id, level });

    // Fetch today's workout details
    const {
      workout: todaysWorkout,
      programId,
      weekNumber,
    } = await fetchUserTodaysWorkout(res);
    // console.log("todaysss workout ", JSON.stringify(todaysWorkout));

    let existingWeekNumber;
    let existingProgramId;
    let existingWorkoutId;
    let existingLevel;
    // Check if the station has already been saved
    let existingStation = null;
    for (const log of workoutLog) {
      // Exit the loop if a completed station is found
      if (
        log.workOutId.toString() === todaysWorkout._id.toString() &&
        log.programId.toString() === programId.toString() &&
        log.userId.toString() === user._id.toString()
      ) {
        if (log.level !== level) {
          return res.status(500).json({
            msg: `Your Level for this workout is ${log.level} You cannot select another level`,
          });
        }
        existingProgramId = log.programId;
        existingWeekNumber = log.weekNumber;
        existingWorkoutId = log.workOutId;
        existingLevel = log.level;
        existingStation = log.stations.find(
          (station) =>
            station.completed === true &&
            station.stationNumber === tab.stationNumber
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
          weekNumber: existingWeekNumber,
          programId: existingProgramId,
          workOutId: existingWorkoutId,
          completed: true,
          measurementType: existingStation.sets[0].measurementType,
          level: existingLevel,
        },
      });
    }

    // Access the stations array
    const stations = todaysWorkout.stations;

    const targetStationNumber = tab.stationNumber;
    const stationIndex = stations.findIndex(
      (station) => station.stationNumber === targetStationNumber
    );

    let workout = {
      station: {
        exerciseName: todaysWorkout.stations[stationIndex].exerciseName,
        stationNumber: todaysWorkout.stations[stationIndex].stationNumber,
        sets: todaysWorkout.stations[stationIndex].sets
          .filter((set) => set.level === level) // Only include Beginner sets
          .map((set) => {
            let setData = {
              measurementType: set.measurementType,
              previous: 0, // default
              lbs: 0, // default
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
        _id: todaysWorkout.stations[stationIndex]._id,
        completed: false, // Mark station as completed if applicable
      },
      userId: user._id,
      weekNumber: weekNumber,
      programId: programId,
      workOutId: todaysWorkout._id,
      measurementType:
        todaysWorkout.stations[stationIndex].sets[0].measurementType,
      completed: false,
      level: level,
    };

    res.status(200).json({
      message: "level data fetched",
      workout,
    });
  } catch (error) {
    return res.status(500).json({ msg: "unable to get level data" });
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
  getLevelData,
};
