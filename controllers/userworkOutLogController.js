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
    const { programId, weekNumber } = req.params;
    const currentProgram = await Program.findOne(
      {
        _id: new mongoose.Types.ObjectId(programId),
        "weeks.weekNumber": parseInt(weekNumber),
      },
      {
        "weeks.$": 1, // returns the data for the specific week
      }
    );

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
  const { userId, programId, weekNumber, workOutId, stations } = req.body;

  try {
    await WorkOutLog.create({
      userId,
      workOutId,
      programId,
      weekNumber,
      stations,
      completed: true,
      completedAt: Date.now(),
    });
    res.status(201).json({ msg: "workOut completed successfully" });
  } catch (error) {
    res.json({ msg: "failed to finish workout" });
  }
};

/*============  End of finsih workout  =============*/

/*=============================================
=                   user completed workouts                   =
=============================================*/
const userCompletedWorkOuts = async (req, res) => {
  try {
    const userId = req.params.userId;
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
  const { userId, weeklyWorkOutGoal } = req.body;
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
