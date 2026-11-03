import { describe, expect, jest, test } from '@jest/globals'
import jwt from 'jsonwebtoken'
import { catchAsync, generateTokenPair } from '../utils/commonFunctions.js'
import {
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  setAuthCookies,
  verifyAccessToken,
  verifyRefreshToken
} from '../utils/authSecurity.js'

describe('generateTokenPair', () => {
  const payload = { userId: '507f1f77bcf86cd799439011' }

  test('issues a strict access token with a fifteen-minute lifetime', () => {
    const { access_token, sessionId } = generateTokenPair(payload)
    const decoded = verifyAccessToken(access_token)

    expect(decoded).toMatchObject({
      userId: payload.userId,
      sub: payload.userId,
      jti: sessionId,
      tokenType: 'access',
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE
    })
    expect(decoded.exp - decoded.iat).toBe(15 * 60)
  })

  test('issues a strict refresh token with the same session ID and a seven-day lifetime', () => {
    const { refresh_token, sessionId } = generateTokenPair(payload)
    const decoded = verifyRefreshToken(refresh_token)

    expect(decoded).toMatchObject({
      userId: payload.userId,
      sub: payload.userId,
      jti: sessionId,
      tokenType: 'refresh',
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE
    })
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60)
  })

  test('access and refresh tokens cannot be verified with each other\'s secret', () => {
    const { access_token, refresh_token } = generateTokenPair(payload)

    expect(() => jwt.verify(access_token, process.env.REFRESH_TOKEN_SECRET_KEY)).toThrow('invalid signature')
    expect(() => jwt.verify(refresh_token, process.env.ACCESS_TOKEN_SECRET_KEY)).toThrow('invalid signature')
  })

  test('uses Secure HttpOnly cookies in production', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const res = { cookie: jest.fn() }
    try {
      setAuthCookies(res, { access_token: 'access', refresh_token: 'refresh' })
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }

    expect(res.cookie).toHaveBeenCalledTimes(2)
    for (const [, , options] of res.cookie.mock.calls) {
      expect(options).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      })
    }
    expect(res.cookie.mock.calls[0][2].path).toBe('/')
    expect(res.cookie.mock.calls[1][2].path).toBe('/api')
  })
})

describe('catchAsync', () => {
  test('lets a successful async handler send its response', async () => {
    const res = { json: jest.fn() }
    const handler = catchAsync(async (_req, response) => {
      response.json({ success: true })
    })

    await handler({}, res, jest.fn())

    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  test('forwards an async rejection to Express error handling', async () => {
    const error = new Error('Database unavailable')
    const next = jest.fn()
    const handler = catchAsync(async () => {
      throw error
    })

    await handler({}, {}, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})
