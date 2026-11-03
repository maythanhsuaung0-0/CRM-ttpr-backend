import express from 'express'
import cors from 'cors'
import UserRouter from './routes/userRoute.js'
import LoginRouter from './routes/loginRoute.js'
import RefreshRouter from './routes/refreshRoute.js'
import CompanyRouter from './routes/companyRoute.js'
import InternshipRouter from './routes/internshipRoute.js'
import cookieParser from 'cookie-parser'
import { checkToken } from './middlewares/middleware.js'
import AdminProfileRouter from './routes/adminRoute.js'
import AppointmentRouter from './routes/appointmentRoute.js'
import DepartmentRouter from './routes/departmentRoute.js'
import IndustryRouter from './routes/industryRoute.js'
import StateRouter from './routes/stateRouter.js'
import CityRouter from './routes/CityRoute.js'
import PositionRouter from './routes/positionRoute.js'
import { emailRoute } from './routes/emailRoute.js'
import StudentRouter from './routes/studentRoute.js'
import MajorRouter from './routes/majorRoute.js'
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js'
import { corsOptions } from './config/cors.js'

const app = express()

app.use(cors(corsOptions()))
app.use(cookieParser())
app.use(express.json())

export const routeMounts = [
  { path: '/api/adminProfile', middleware: [checkToken], router: AdminProfileRouter },
  { path: '/api/refresh', middleware: [], router: RefreshRouter },
  { path: '/api/internship', middleware: [checkToken], router: InternshipRouter },
  { path: '/api/company', middleware: [checkToken], router: CompanyRouter },
  { path: '/api/industry', middleware: [], router: IndustryRouter },
  { path: '/api/users', middleware: [], router: UserRouter },
  { path: '/api/auth', middleware: [], router: LoginRouter },
  { path: '/api/department', middleware: [checkToken], router: DepartmentRouter },
  { path: '/api/position', middleware: [checkToken], router: PositionRouter },
  { path: '/api/cities', middleware: [], router: CityRouter },
  { path: '/api/states', middleware: [], router: StateRouter },
  { path: '/api/email', middleware: [checkToken], router: emailRoute },
  { path: '/api/studentProfile', middleware: [checkToken], router: StudentRouter },
  { path: '/api/major', middleware: [checkToken], router: MajorRouter },
  { path: '/api/appointment', middleware: [checkToken], router: AppointmentRouter },
]

for (const { path, middleware, router } of routeMounts) {
  app.use(path, ...middleware, router)
}

app.use(notFoundHandler)
app.use(errorHandler)

export default app
