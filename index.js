const mongoose = require("mongoose");
const express = require("express");
const authRoute = require("./routes/authRoute");
const programRoute = require("./routes/programRoute");
const workOutLogRoute = require("./routes/userworkOutLogRoute");
const dashboardRoute = require("./routes/dashboard");
const tabSectionRoute = require("./routes/tabSection");
const config = require("./config/config");
const cron = require("node-cron");
const User = require("./models/user");
const { updateUserStreak } = require("./utils/userWorkOutLog");

const app = express();

app.use(express.json()); // Middleware for parsing JSON

// Use routes
app.use("/user", authRoute);
app.use("/programs", programRoute);
app.use("/workout", workOutLogRoute);
app.use("/dashboard", dashboardRoute);
app.use("/tab", tabSectionRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err); // Log the error
  res.status(500).json({ message: err.message }); // Send error response
});

/**
 * Cron Job: Weekly Streak Update *
 * Scheduled to run every Sunday at midnight (00:00).
 *
 * This job fetches all users and updates their workout streaks
 * based on weekly goals. If `workoutsInWeek` meets or exceeds
 * `weeklyWorkOutGoal`, the streak is incremented; otherwise,
 * it resets to zero. The `workoutsInWeek` field is reset
 * for the new week, promoting user engagement in fitness.
 */
cron.schedule("0 0 * * 0", async () => {
  const users = await User.find();
  for (const user of users) {
    await updateUserStreak(user._id);
  }
});

// Connect to MongoDB
mongoose
  .connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Start the server
const PORT = process.env.PORT || 7005;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
