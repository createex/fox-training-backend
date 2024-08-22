// otpVerifier.js
const otpStore = new Map(); // Simple in-memory store for OTPs

const storeOTP = (email, otp) => {
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // OTP expires in 5 minutes
};

const verifyOTP = (email, otp) => {
  const data = otpStore.get(email);
  if (!data) return false;

  const { otp: storedOtp, expiresAt } = data;
  if (Date.now() > expiresAt) {
    otpStore.delete(email); // OTP expired
    return false;
  }

  return storedOtp === otp;
};

module.exports = { storeOTP, verifyOTP };
