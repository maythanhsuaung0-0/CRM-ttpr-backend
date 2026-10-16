import { describe, expect, jest, test } from '@jest/globals'
import jwt from 'jsonwebtoken'
import { catchAsync, generateTokenPair } from '../utils/commonFunctions.js'

describe('generateTokenPair', () => {
  const payload = { userId: '507f1f77bcf86cd799439011' }

  test('issues an access token with the user ID and a one-hour lifetime', () => {
    const { access_token } = generateTokenPair(payload)
    const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET_KEY)

    expect(decoded.userId).toBe(payload.userId)
    expect(decoded.exp - decoded.iat).toBe(60 * 60)
  })

  test('issues a refresh token with the user ID and a seven-day lifetime', () => {
    const { refresh_token } = generateTokenPair(payload)
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET_KEY)

    expect(decoded.userId).toBe(payload.userId)
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60)
  })

  test('access and refresh tokens cannot be verified with each other\'s secret', () => {
    const { access_token, refresh_token } = generateTokenPair(payload)

    expect(() => jwt.verify(access_token, process.env.REFRESH_TOKEN_SECRET_KEY)).toThrow('invalid signature')
    expect(() => jwt.verify(refresh_token, process.env.ACCESS_TOKEN_SECRET_KEY)).toThrow('invalid signature')
  })
})

describe('catchAsync', () => {
  test('lets a successful async handler send its response', async () => {
    const res = { json: jest.fn() }
    const handler = catchAsync(async (_req, response) => {
      response.json({ success: true })
    })

    handler({}, res, jest.fn())

    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  test('turns an async rejection into a JSON error response', async () => {
    const res = { status: jest.fn().mockReturnThis() }
    const handler = catchAsync(async () => {
      throw new Error('Database unavailable')
    })

    const body = await new Promise((resolve) => {
      res.json = jest.fn(resolve)
      handler({}, res, jest.fn())
    })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(body).toEqual({ message: 'Database unavailable' })
  })
})
