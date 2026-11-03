import LoginCredentials from '../models/Login.js'
import User from '../models/User.js'
import { catchAsync } from '../utils/commonFunctions.js'
import {
  clearAuthCookies,
  generateTokenPair,
  hashRefreshToken,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  verifyRefreshToken
} from '../utils/authSecurity.js'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'

export const loginAttempt = catchAsync(async (req, res) => {
  const { email: req_email, password: req_pwd } = req.body;
  const normalizedEmail = req_email?.trim().toLowerCase()
  const user = await User.findOne({ email: normalizedEmail }).select('+password')
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const { _id, email, password, role, verified, locked } = user
  if (locked) {
    return res.status(403).json({ message: 'Login is Forbidden' })
  }
  if (role === 'admin' && !verified) {
    return res.status(403).json({ message: 'Please wait to be approved by school to login as admin' })
  }

  const passwordMatches = await argon2.verify(password, req_pwd)
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const tokens = generateTokenPair({ userId: _id })
  const previousSession = await LoginCredentials.exists({ user_id: String(_id) })

  // Existing plaintext sessions are invalidated along with any previous hashed session.
  await LoginCredentials.deleteMany({ user_id: String(_id) })
  await LoginCredentials.create({
    session_id: tokens.sessionId,
    refresh_token_hash: hashRefreshToken(tokens.refresh_token),
    user_id: String(_id),
    email,
    is_first_login: !previousSession,
    created_at: new Date(),
    expired_at: tokens.refreshExpiresAt
  })

  setAuthCookies(res, tokens)
  return res.status(200).json({
    message: {
      role,
      is_first_login: !previousSession
    }
  })
})

export const refreshAccessToken = catchAsync(async (req, res) => {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!presentedToken) {
    clearAuthCookies(res)
    return res.status(401).json({ message: 'Refresh token required' })
  }

  let decoded
  try {
    decoded = verifyRefreshToken(presentedToken)
  } catch (error) {
    clearAuthCookies(res)
    const message = error instanceof jwt.TokenExpiredError
      ? 'Refresh token expired'
      : 'Invalid refresh token'
    return res.status(401).json({ message })
  }

  const nextTokens = generateTokenPair({ userId: decoded.userId })
  const rotatedSession = await LoginCredentials.findOneAndUpdate(
    {
      session_id: decoded.jti,
      user_id: String(decoded.userId),
      refresh_token_hash: hashRefreshToken(presentedToken),
      expired_at: { $gt: new Date() }
    },
    {
      $set: {
        session_id: nextTokens.sessionId,
        refresh_token_hash: hashRefreshToken(nextTokens.refresh_token),
        created_at: new Date(),
        expired_at: nextTokens.refreshExpiresAt
      }
    },
    { new: true, runValidators: true }
  )

  if (!rotatedSession) {
    clearAuthCookies(res)
    return res.status(401).json({
      message: 'Refresh session is invalid or has already been used'
    })
  }

  setAuthCookies(res, nextTokens)
  return res.status(200).json({ message: 'Refreshed successfully' })
})

export const logoutAttempt = catchAsync(async (req, res) => {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME]
  if (presentedToken) {
    await LoginCredentials.deleteOne({
      refresh_token_hash: hashRefreshToken(presentedToken)
    })
  }

  clearAuthCookies(res)
  return res.status(200).json({ message: 'Logged out' })
})
