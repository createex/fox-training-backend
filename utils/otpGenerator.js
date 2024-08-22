// otpGenerator.js
const generateOTP = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    return otp;
  };
  
  module.exports = generateOTP;
  