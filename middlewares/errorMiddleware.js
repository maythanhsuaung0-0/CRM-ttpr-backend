import { AppError } from '../utils/AppError.js'

export const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404))
}

export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  const isDuplicateKey = error?.code === 11000
  const statusCode = isDuplicateKey
    ? 409
    : Number.isInteger(error.statusCode) ? error.statusCode : 500
  const isProduction = process.env.NODE_ENV === 'production'
  const isOperational = error.isOperational || isDuplicateKey
  const message = isDuplicateKey
    ? 'A record with that unique value already exists'
    : isProduction && !isOperational
      ? 'Internal server error'
      : error.message || 'Internal server error'

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(error)
  }

  return res.status(statusCode).json({ message })
}
