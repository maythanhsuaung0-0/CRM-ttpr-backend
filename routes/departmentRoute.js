import { Router } from "express";
import { getDepartmentById, updateDepartment, deleteDepartment, createDepartment, getDepartment} from "../controllers/departmentController.js"; 

const DepartmentRouter = Router();
DepartmentRouter.post('/create', createDepartment);
DepartmentRouter.get('/:id', getDepartmentById);
DepartmentRouter.get('/', getDepartment);
DepartmentRouter.patch('/:id', updateDepartment);
DepartmentRouter.delete('/:id', deleteDepartment);
export default DepartmentRouter;
