// src/utils/sendEmail.js
const { Resend } = require('resend');
const config = require('../config/config');

const resend = new Resend(config.resendApiKey);

async function sendEmail(to, subject, text) {
    try {
        console.log('Sending email...');
        const { data, error } = await resend.emails.send({
            from: 'donotreply@advyro.com',
            to: [to],
            subject: subject,
            text: text,
        });

        if (error) {
            console.error('Error sending email:', error);
            return false;
        }

        console.log('Email sent successfully:', data);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}
const sendOTPEmail = async (email, otp) => {
    try {
        console.log('Sending OTP email...');
        const { data, error } = await resend.emails.send({
            from: 'donotreply@advyro.com', // Adjust the sender email as needed
            to: [email],
            subject: "Your OTP Code",
            text: `Your OTP code is: ${otp}`,
            html: `<h1>Your OTP code is: ${otp}</h1>`
        });

        if (error) {
            console.error('Error sending email:', error);
            throw new Error(`Error sending email: ${error}`);
        }

        console.log('Email sent successfully:', data);
        return { data, otp };
    } catch (error) {
        console.error('Error sending email:', error.message);
        throw new Error(`Error sending email: ${error.message}`);
    }
};
module.exports = {
    sendEmail,
    sendOTPEmail
};
