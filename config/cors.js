import { AppError } from '../utils/AppError.js'

export const allowedOrigins = () => {
  const configured = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []

  if (configured.length > 0) {
    return configured
  }

  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']
}

export const corsOptions = () => {
  const allowlist = new Set(allowedOrigins())
  return {
    origin(origin, callback) {
      if (!origin || allowlist.has(origin)) {
        return callback(null, true)
      }
      return callback(new AppError('Origin not allowed by CORS', 403))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  }
}
