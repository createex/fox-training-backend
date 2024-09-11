const express = require("express");
const { check } = require("express-validator");
const authController = require("../controllers/authController");
const { verifyOTP } = require("../utils/otpVerifier");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

// User registration route
router.post(
  "/register",
  [
    check("email").isEmail().withMessage("Valid email is required"),
    check("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    check("confirmPassword")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Password confirmation does not match password");
        }
        return true;
      })
      .withMessage("Passwords do not match"),
  ],
  authController.registerUser
);

router.post(
  "/login",
  [
    check("email").isEmail().withMessage("Valid email is required"),
    check("password").not().isEmpty().withMessage("Password is required"),
  ],
  authController.loginUser
);

router.post(
  "/forgot-password",
  [check("email").isEmail().withMessage("Valid email is required")],
  authController.forgotPassword
);

router.post(
  "/reset-password",
  [
    check("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  authMiddleware,
  authController.resetPassword
);
router.get("/profile", authMiddleware, authController.getUserProfile);
router.patch("/edit-profile", authMiddleware, authController.editProfile);

module.exports = router;
