import catchError from "../middlewares/catchError.js";
import ErrorHandler from "../middlewares/error.js";
import { User } from "../models/userSchema.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";

const client = twilio(process.env.TWILLIO_SID, process.env.TWILLIO_AUTH_TOKEN);

export const register = catchError(async (req, res, next) => {
  try {
    const { name, email, password, phone, verificationMethod } = req.body;
    if (!name || !email || !password || !phone || !verificationMethod) {
      return next(new ErrorHandler("All fields are required!", 400));
    }
    function validatePhoneNumber(phone) {
      const phoneRegix = /^\+923\d{9}$/;
      return phoneRegix.test(phone);
    }
    if (!validatePhoneNumber(phone)) {
      return next(new ErrorHandler("Invalid phone number!", 400));
    }
    const existingUser = await User.findOne({
      $or: [
        {
          email,
          accountVerified: true,
        },
        {
          phone,
          accountVerified: true,
        },
      ],
    });

    if (existingUser) {
      return next(new ErrorHandler("Email or phone already registered!", 400));
    }

    const registrationAttemptsByUser = await User.find({
      $or: [
        {
          phone,
          accountVerified: false,
        },
        {
          email,
          accountVerified: false,
        },
      ],
    });

    if (registrationAttemptsByUser >= 3) {
      return next(
        new ErrorHandler("Please attempt registering after 1 hour!", 400)
      );
    }

    const userData = {
      name,
      email,
      phone,
      password,
    };

    const user = await User.create(userData);
    const verificationCode = await user.generateVerificationCode();
    await user.save();
    sendVerificationCode(verificationMethod, verificationCode, email, phone);
    res.status(200).json({
      success: true,
      message: "Verification email sent successfully!",
    });
  } catch (err) {
    next(err);
  }
});

async function sendVerificationCode(
  verificationMethod,
  verificationCode,
  email,
  phone
) {
  try {
    if (verificationMethod === "email") {
      const message = generateEmailTemplate(verificationCode);
      sendEmail({ email, message, subject: "Your Verification Code." });
    } else if (verificationMethod === "phone") {
      const verificationCodeWithSpace = verificationCode
        .toString()
        .split("")
        .join(" ");
      await client.calls.create({
        twiml: `<Response><Say>Your verification code is ${verificationCodeWithSpace} Your verification code is ${verificationCodeWithSpace}</Say></Response>`,
        from: process.env.TWILLIO_PHONE,
        to: phone,
      });
      res.status(200).json({
        success: true,
        message: "OTP Sent!",
      });
    } else {
      throw new ErrorHandler("Invalid method!", 500);
    }
  } catch (error) {
    throw new ErrorHandler("Invalid method!", 500);
  }
}

function generateEmailTemplate(verificationCode) {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
    <h2 style="color: #4CAF50; text-align: center;">Verification Code</h2>
    <p style="font-size: 16px; color: #333;">Dear User,</p>
    <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 18px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50;">
            ${verificationCode}
        </span>
    </div>
    <p style="font-size: 16px; color: #333;">Please use this code to verify your email address. The code will expire in 10 minutes.</p>
    <footer style="margin-top: 20px; text-align: center; font-size: 14px; color: #999;">
        <p>Thank you,<br>Your Company Team</p>
        <p style="font-size: 12px; color: #aaa;">This is an automated message. Please do not reply to this email.</p>
    </footer>
</div>
`;
}

export const verifyOTP = catchError(async (req, res, next) => {
  const { email, otp, phone } = req.body;
  function validatePhoneNumber(phone) {
    const phoneRegix = /^\+923\d{9}$/;
    return phoneRegix.test(phone);
  }
  if (!validatePhoneNumber(phone)) {
    return next(new ErrorHandler("Invalid phone number!", 400));
  }

  try {
    const userAllEntries = await User.find({
      $or: [
        {
          email,
          accountVerified: false,
        },
        {
          phone,
          accountVerified: false,
        },
      ],
    }).sort({ createdAt: -1 });

    if (userAllEntries === 0) {
      return next(new ErrorHandler("User not found!", 404));
    }

    let user;
    if (userAllEntries.length > 1) {
      user = userAllEntries;
      await User.deleteMany({
        _id: { $ne: user._id },
        $or: [
          {
            email,
            accountVerified: false,
          },
          {
            phone,
            accountVerified: false,
          },
        ],
      });
    } else {
      user = userAllEntries[0];
    }

    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Inavlid OTP!", 400));
    }
    const currentTime = Date.now();
    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();
    console.log(currentTime);
    console.log(verificationCodeExpire);
    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP Expired!", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account Verified!", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error.", 500));
  }
});

export const login = catchError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required!", 400));
  }
  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );
  if (!user) {
    return next(new ErrorHandler("Invalid email or password!", 400));
  }

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) {
    return next(new ErrorHandler("Invalid email or password!", 400));
  }
  sendToken(user, 200, "Successfully Logged in!", res);
});

export const logout = catchError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: true,
      sameSite: "None",
    })
    .json({
      success: true,
      message: "Successfully logged out!",
    });
});

export const getUser = catchError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgotPassword = catchError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it.`;

  try {
    sendEmail({
      email: user.email,
      subject: "PASSWORD RESET",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler(
        error.message ? error.message : "Cannot send reset password token.",
        500
      )
    );
  }
});

export const resetPassword = catchError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset password token is invalid or has been expired.",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password & confirm password do not match.", 400)
    );
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendToken(user, 200, "Password successfully reset.", res);
});
