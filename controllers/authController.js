const User = require("../models/user");
const { generateToken } = require("../utils/jwt");
const generateOTP = require("../utils/otpGenerator");
const { storeOTP, verifyOTP } = require("../utils/otpVerifier");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");

async function registerUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, confirmPassword, username } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      confirmPassword: hashedPassword,
    });

    // await sendEmail(email, subject, confirmationMessage);

    const savedUser = await newUser.save();

    const token = generateToken(newUser._id);

    res.status(201).json({
      message: "User registered successfully",
      user: savedUser,
      token,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function loginUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    //updating last active status
    user.lastActiveAt = new Date(); // Set to current timestamp
    await user.save();
    const token = generateToken(user._id);

    res.status(200).json({ message: "Login successful", user, token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Error logging in" });
  }
}

async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    //   const otp = generateOTP();
    //   console.log(otp);
    //   storeOTP(email, otp);

    //   const mail = await sendOTPEmail(email, otp);

    return res.status(200).json({ message: "user found" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while resetting password" });
  }
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.user._id;
  const { password } = req.body;
  const { confirmPassword } = req.body;

  try {
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }
    console.log(user.password);
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.confirmPassword = hashedPassword;
    console.log(user.password);
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
};
