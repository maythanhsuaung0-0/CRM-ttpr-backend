export class AppError extends Error {
  constructor(message, statusCode, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}
