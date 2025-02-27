import express from "express";
import {
  getUser,
  login,
  logout,
  register,
  verifyOTP,
  forgotPassword,
  resetPassword,
} from "../controllers/userController.js";
import { Authenticated } from "../middlewares/auth.js";

const router = express.Router();
router.post("/register", register);
router.post("/otp", verifyOTP);
router.post("/login", login);
router.get("/logout", Authenticated, logout);
router.get("/me", Authenticated, getUser);
router.post("/password/forgot", forgotPassword);
router.put("/password/reset/:token", resetPassword);

export default router;
