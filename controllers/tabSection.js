const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Tab = require("../models/tabSection");
const { TAB_JWT_SECRET } = require("../config/config");
const User = require("../models/user");

const createTab = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
      return res.status(500).json({ msg: "please provide all fields values" });
    }
    if (password !== confirmPassword) {
      return res.status(500).json({ msg: "password does not match" });
    }
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the tab password
    const newTab = new Tab({ password: hashedPassword });
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
    console.log(tabId);

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

    res.json({ message: "User logged in successfully" });
  } catch (error) {
    console.error("Error logging in user to tab:", error);
    res.status(500).json({ message: "Failed to log in user to tab" });
  }
};

module.exports = {
  createTab,
  loginToTab,
  userLoginToTab,
};
