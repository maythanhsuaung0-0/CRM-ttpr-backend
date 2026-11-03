import { Router } from "express";
import { createMajor, deleteMajor, getMajor, getMajorById, updateMajor } from "../controllers/majorController.js";

const MajorRouter = Router();

MajorRouter.get("/", getMajor);
MajorRouter.post("/", createMajor);
MajorRouter.get("/:id", getMajorById);
MajorRouter.patch("/:id", updateMajor);
MajorRouter.delete("/:id", deleteMajor);

export default MajorRouter;
