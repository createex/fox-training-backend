const express = require("express");
const router = express.Router();
const {
  createTab,
  loginToTab,
  userLoginToTab,
  saveWorkout,
  changePassword,
  deleteTab,
  getAllTabs,
  getAllUsernames,
} = require("../controllers/tabSection");
const verifyTabToken = require("../middleware/tabAuth");
const verifyAuthToken = require("../middleware/auth");

//admin creates tab
router.get("/all-tabs", verifyAuthToken, getAllTabs);
router.get("/all-usernames", verifyTabToken, getAllUsernames);
router.post("/create-tab", verifyAuthToken, createTab);
router.post("/login", loginToTab);
router.post("/user-login", verifyTabToken, userLoginToTab);
router.post("/save-workout", verifyTabToken, saveWorkout);
router.patch("/change-password/:tabId", verifyAuthToken, changePassword);
router.delete("/:tabId", verifyAuthToken, deleteTab);

module.exports = router;
