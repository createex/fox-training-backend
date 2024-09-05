const mongoose = require("mongoose");

const tabSchema = new mongoose.Schema({
  //   name: { type: String, required: true },
  password: { type: String, required: true }, // Password specific to the tab
  loggedInUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  tabNumber: {
    type: Number,
    required: true,
    default: 0,
  },
});

module.exports = mongoose.model("Tab", tabSchema);
