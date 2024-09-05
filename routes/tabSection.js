const express = require("express");
const router = express.Router();
const {
  createTab,
  loginToTab,
  userLoginToTab,
} = require("../controllers/tabSection");
const verifyTabToken = require("../middleware/tabAuth");

//admin creates tab

router.post("/create-tab", createTab);
router.post("/:tabId/login", loginToTab);
router.post("/user-login", verifyTabToken, userLoginToTab);

module.exports = router;
