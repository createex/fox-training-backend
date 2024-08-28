const User = require("../models/user");
const Program = require("../models/program");
const WorkOutLog = require("../models/userWorkOutLog");
const { default: mongoose } = require("mongoose");
const moment = require("moment");

/*=============================================
=                   start workout                   =
=============================================*/

//start workout
const startWorkOut = async (req, res) => {
  try {
    const { workOutId } = req.params;

    // Query using the dot notation to access nested arrays properly
    const currentProgram = await Program.findOne(
      {
        "weeks.workouts._id": workOutId,
      },
      {
        "weeks.$": 1,
      }
    );

    if (!currentProgram) {
      return res.status(404).json({ msg: "Program not found" });
    }

    res.status(200).json(currentProgram);
  } catch (error) {
    res.json({ msg: "program not found" });
  }
};

/*============  End of start workout  =============*/

/*=============================================
=                   finsih workout                   =
=============================================*/

const finishWorkOut = async (req, res) => {
  const { programId, weekNumber, workOutId, stations } = req.body;

  try {
    await WorkOutLog.create({
      userId: req.user._id,
      workOutId,
      programId,
      weekNumber,
      stations,
      completed: true,
      completedAt: Date.now(),
    });
    res.status(201).json({ msg: "workOut completed successfully" });
  } catch (error) {
    res.json({ msg: "failed to finish workout", error: error });
  }
};

/*============  End of finsih workout  =============*/

/*=============================================
=                   user completed workouts                   =
=============================================*/
const userCompletedWorkOuts = async (req, res) => {
  try {
    const userId = req.user._id;
    const completedWorkOuts = await WorkOutLog.find({
      userId,
      completed: true,
    }).sort({ completedAt: 1 });

    //calculating workout streak
    let streak = 0;
    let lastWeek = null;
    completedWorkOuts.forEach((log) => {
      //week number of the week at which the workout is completed
      const logWeek = moment(log.completedAt).isoWeek();

      if (lastWeek === null || logWeek === lastWeek + 1) {
        streak++;
        lastWeek = logWeek;
      } else if (logWeek !== lastWeek) {
        streak = 1; // Streak breaks if the current log week is not consecutive
        lastWeek = logWeek;
      }
    });
    const dates = completedWorkOuts.map((logs) =>
      moment(logs.completedAt).format("DD-MM-YYYY")
    );

    //return workouts completed by user, count them, return workout streak,dates of completion
    res.status(200).json({
      completedWorkOuts,
      count: completedWorkOuts.length,
      streak,
      completionDates: dates,
    });
  } catch (error) {
    res.json({ msg: "error finding user workOuts", error });
  }
};

/*============  End of user completed workouts  =============*/

/*=============================================
=                   set weekly workout goad                   =
=============================================*/

const setWeeklyGoal = async (req, res) => {
  const { weeklyWorkOutGoal } = req.body;
  const userId = req.user._id;
  console.log(req.body);

  try {
    const updatedUserWorkOut = await WorkOutLog.findOneAndUpdate(
      { userId },
      { $set: { weeklyWorkOutGoal: weeklyWorkOutGoal } },
      { new: true }
    );
    if (!updatedUserWorkOut) {
      return res.json({ msg: "user workOut history not found" });
    }
    res.status(200).json({
      msg: "Weekly workOut Goal set successfully",
      updatedUserWorkOut,
    });
  } catch (error) {
    res.json({ msg: "error updating weekly goal", error });
  }
};

/*============  End of set weekly workout goad  =============*/

module.exports = {
  startWorkOut,
  finishWorkOut,
  setWeeklyGoal,
  userCompletedWorkOuts,
};
