import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { AppError } from '../utils/AppError.js'
import { errorHandler, notFoundHandler } from '../middlewares/errorMiddleware.js'

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

const response = () => ({
  headersSent: false,
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
})

describe('central error middleware', () => {
  test('turns an unmatched route into an operational 404 error', () => {
    const next = jest.fn()

    notFoundHandler({ method: 'GET', originalUrl: '/missing' }, {}, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Route GET /missing not found',
      statusCode: 404,
      isOperational: true
    }))
  })

  test('serializes an operational error with its status and message', () => {
    const res = response()

    errorHandler(new AppError('Record not found', 404), {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Record not found' })
  })

  test('hides unexpected internal messages in production', () => {
    process.env.NODE_ENV = 'production'
    const res = response()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    errorHandler(new Error('Database credentials leaked'), {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' })
  })

  test('maps duplicate-key races to a safe conflict response', () => {
    const res = response()
    const error = Object.assign(new Error('duplicate key email private@example.com'), {
      code: 11000,
      keyValue: { email: 'private@example.com' }
    })

    errorHandler(error, {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      message: 'A record with that unique value already exists'
    })
  })

  test('delegates when response headers have already been sent', () => {
    const error = new Error('Late failure')
    const next = jest.fn()
    const res = { ...response(), headersSent: true }

    errorHandler(error, {}, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
  })
})
