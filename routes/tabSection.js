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
} = require("../controllers/tabSection");
const verifyTabToken = require("../middleware/tabAuth");
const verifyAuthToken = require("../middleware/auth");

//admin creates tab
router.get("/all-tabs", verifyAuthToken, getAllTabs);
router.post("/create-tab", verifyAuthToken, createTab);
router.post("/:tabId/login", verifyAuthToken, loginToTab);
router.post("/user-login", verifyTabToken, userLoginToTab);
router.post("/save-workout", verifyTabToken, saveWorkout);
router.patch("/change-password", verifyTabToken, changePassword);
router.delete("/:tabId", deleteTab);

module.exports = router;
