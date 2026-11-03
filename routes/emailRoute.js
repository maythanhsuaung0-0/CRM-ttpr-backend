import { Router } from "express";
import { sendEmail } from "../controllers/emailController.js";

export const emailRoute = Router();
emailRoute.post('/send', sendEmail);
