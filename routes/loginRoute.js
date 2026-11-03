import { Router } from "express";
import { loginAttempt, logoutAttempt } from "../controllers/loginController.js";

const LoginRouter = Router()
LoginRouter.post('/login', loginAttempt)
LoginRouter.post('/logout', logoutAttempt)
export default LoginRouter

