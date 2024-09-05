const express = require("express");
const router = express.Router();
const {
  createTab,
  loginToTab,
  userLoginToTab,
  saveWorkout,
  changePassword,
  deleteTab,
} = require("../controllers/tabSection");
const verifyTabToken = require("../middleware/tabAuth");

//admin creates tab

router.post("/create-tab", createTab);
router.post("/:tabId/login", loginToTab);
router.post("/user-login", verifyTabToken, userLoginToTab);
router.post("/save-workout", verifyTabToken, saveWorkout);
router.patch("/change-password", verifyTabToken, changePassword);
router.delete("/:tabId", deleteTab);

module.exports = router;
